import os
import re
import uuid
import json
import logging
from typing import List, Optional

import azure.functions as func
import azure.durable_functions as df
from azure.storage.blob.aio import BlobServiceClient
from azure.core.exceptions import ResourceExistsError

from services.validation import ValidatedDocument, is_content_valid, MAX_SIZE_BYTES, ALLOWED_EXTENSIONS

bp = df.Blueprint()

STORAGE_CONN_STR: Optional[str] = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
CONTAINER_NAME: str = os.getenv("RAW_DOCUMENTS_CONTAINER", "raw-documents")

async def process_single_document(
    doc: ValidatedDocument, 
    container_client, 
    durable_client: df.DurableOrchestrationClient, 
    req: func.HttpRequest
) -> dict:
    unique_id = str(uuid.uuid4())
    safe_filename = re.sub(r'[^a-zA-Z0-9_\.-]', '_', doc.original_filename)
    blob_name = f"{unique_id}-{safe_filename}"

    try:
        blob_client = container_client.get_blob_client(blob_name)
        await blob_client.upload_blob(doc.content, overwrite=True)

        document_context = {
            "unique_id": unique_id,
            "original_filename": doc.original_filename,
            "stored_blob_name": blob_name
        }

        instance_id = await durable_client.start_new("analyze_orchestrator", None, document_context)
        status_response = durable_client.create_check_status_response(req, instance_id)
        status_json = json.loads(status_response.get_body().decode('utf-8'))
        status_json['filename'] = doc.original_filename
        
        return status_json

    except Exception as e:
        logging.error(f"Error processing {doc.original_filename}: {e}")
        return {
            "filename": doc.original_filename, 
            "error": "Fallo en el almacenamiento o en la inicialización del orquestador."
        }

@bp.route(route="analyze", methods=["POST"])
@bp.durable_client_input(client_name="client")
async def analyze_document_async_starter(
    req: func.HttpRequest, 
    client: df.DurableOrchestrationClient
) -> func.HttpResponse:
    
    if not STORAGE_CONN_STR:
        return func.HttpResponse(
            "Configuración de servidor incompleta: AZURE_STORAGE_CONNECTION_STRING.", 
            status_code=500
        )
    
    files = req.files
    if not files or not files.getlist('file'):
        return func.HttpResponse("Faltan los archivos en el form-data bajo la llave 'file'.", status_code=400)

    valid_documents: List[ValidatedDocument] = []
    errors: List[str] = []

    for uploaded_file in files.getlist('file'):
        original_filename = uploaded_file.filename
        _, ext = os.path.splitext(original_filename)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            errors.append(f"Extensión no permitida: {original_filename}")
            continue

        file_bytes = uploaded_file.read()
        if not file_bytes or len(file_bytes) > MAX_SIZE_BYTES:
            errors.append(f"Archivo vacío o excede el límite de tamaño: {original_filename}")
            continue

        if not is_content_valid(file_bytes, ext):
            errors.append(f"Contenido corrupto o no coincide con la extensión: {original_filename}")
            continue

        valid_documents.append(ValidatedDocument(original_filename, ext, file_bytes))

    if not valid_documents:
        return func.HttpResponse(
            body=json.dumps({"validation_errors": errors}), 
            mimetype="application/json", 
            status_code=400
        )

    blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONN_STR)
    results: List[dict] = []
    
    try:
        async with blob_service_client:
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            try:
                await container_client.create_container()
            except ResourceExistsError:
                pass

            for doc in valid_documents:
                result = await process_single_document(doc, container_client, client, req)
                results.append(result)

    except Exception as e:
        logging.error(f"Blob Storage connection failure: {e}")
        return func.HttpResponse("Error interno de conexión con el almacenamiento.", status_code=502)

    response_payload = {"results": results}
    if errors:
        response_payload["validation_errors"] = errors

    return func.HttpResponse(
        body=json.dumps(response_payload),
        mimetype="application/json",
        status_code=202
    )