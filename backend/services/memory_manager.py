import os
import uuid
from datetime import datetime, timezone
from openai import AzureOpenAI
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

class LabMemory:
    def __init__(self):
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT_EMBEDDING", "").strip()
        api_key = os.getenv("AZURE_OPENAI_KEY_EMBEDDING", "").strip()
        self.deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "").strip()

        self.ai_client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-02-15-preview" # Versión clave para text-embedding-3
        )

        self.search_client = SearchClient(
            endpoint=os.getenv("AZURE_SEARCH_ENDPOINT", "").strip(),
            index_name="nextstep-lab-notebook-memory",
            credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_KEY", "").strip())
        )

    def get_embedding(self, text):
        
        clean_text = str(text).replace("\n", " ").strip()
        
        try:
            
            response = self.ai_client.embeddings.create(
                input=clean_text, 
                model=self.deployment
            )

            return response.data[0].embedding
        except Exception as e:
            print(f"Error: {str(e)}")
            raise e

    def store_memory(self, experiment_id, prompt, recommendation, project_name="General", status="Aprobado", outcome_notes="N/A"):
        """Guarda el documento en Azure Search"""
        # Paso 1: Obtener vector
        vector = self.get_embedding(f"{prompt} {recommendation}")
        
        timestamp_ready = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        document = {
            "id": str(uuid.uuid4()),
            "experiment_id": str(experiment_id),
            "project_name": str(project_name),
            "original_prompt": str(prompt),
            "recommendation_text": str(recommendation),
            "status": str(status),
            "outcome_notes": str(outcome_notes),
            "timestamp": timestamp_ready,
            "content_vector": vector
        }
        
        try:
            self.search_client.upload_documents(documents=[document])
            print(f"Memoria inyectada con éxito ({len(vector)} dims).")
        except Exception as e:
            print(f"Error en Azure Search: {str(e)}")
            raise e

    def search_similar_experiments(self, query_text, top_k=3):
        vector = self.get_embedding(query_text)
        vector_query = VectorizedQuery(vector=vector, k_nearest_neighbors=top_k, fields="content_vector")
        results = self.search_client.search(search_text=None, vector_queries=[vector_query], select=["original_prompt", "recommendation_text", "outcome_notes", "status"])
        ctx = ""
        for res in results:
            ctx += f"\n- Pasado: {res.get('original_prompt')}\n  Resultado: {res.get('outcome_notes')}\n"
        return ctx