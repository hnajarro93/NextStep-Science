import azure.durable_functions as df
import os
from azure.storage.blob import BlobServiceClient

bp = df.Blueprint()

def _download_blob(blob_name: str) -> bytes:
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container = os.getenv("RAW_DOCUMENTS_CONTAINER", "raw-documents")
    client = BlobServiceClient.from_connection_string(conn_str).get_blob_client(container, blob_name)
    return client.download_blob().readall()

@bp.activity_trigger(input_name="blobName")
def extract_csv_data(blobName: str) -> str:
    csv_bytes = _download_blob(blobName)
    return csv_bytes.decode('utf-8')

@bp.activity_trigger(input_name="blobName")
def extract_pdf_data(blobName: str) -> str:
    # Aquí ir tu código de Azure Document Intelligence
    return "Texto extraído simulado por brevedad."

@bp.activity_trigger(input_name="blobName")
def extract_image_data(blobName: str) -> str:
    return "Imagen extraída."