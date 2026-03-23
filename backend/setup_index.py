import os
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
)

# --- 1. CONFIGURACIÓN ---
SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT").strip()
SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY").strip()
INDEX_NAME = "nextstep-lab-notebook-memory"

def create_vector_index():
    print(f"Conectando a {SEARCH_ENDPOINT}...")
    credential = AzureKeyCredential(SEARCH_KEY)
    index_client = SearchIndexClient(endpoint=SEARCH_ENDPOINT, credential=credential)

    # --- 2. CONFIGURACIÓN DEL MOTOR VECTORIAL ---
    # Usamos HNSW algoritmo estándar y más rápido 
    vector_search = VectorSearch(
        algorithms=[HnswAlgorithmConfiguration(name="hnsw-algo")],
        profiles=[VectorSearchProfile(name="my-vector-profile", algorithm_configuration_name="hnsw-algo")]
    )

    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True),
        SimpleField(name="experiment_id", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="project_name", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="original_prompt", type=SearchFieldDataType.String),
        SearchableField(name="recommendation_text", type=SearchFieldDataType.String),
        SimpleField(name="status", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="outcome_notes", type=SearchFieldDataType.String),
        SimpleField(name="timestamp", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
        
        SearchField(
            name="content_vector", 
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single), 
            searchable=True, 
            vector_search_dimensions=3072, 
            vector_search_profile_name="my-vector-profile"
        )
    ]

    index = SearchIndex(name=INDEX_NAME, fields=fields, vector_search=vector_search)
    
    print(f"Creando índice '{INDEX_NAME}'...")
    try:
        # Esto crea o actualiza el índice en Azure
        result = index_client.create_or_update_index(index)
        print(f"Indice '{result.name}' creado correctamente.")
    except Exception as e:
        print(f"Error al crear el índice: {e}")

if __name__ == "__main__":
    create_vector_index()