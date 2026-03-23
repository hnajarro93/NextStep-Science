import os
import json
from services.memory_manager import LabMemory
from openai import AzureOpenAI

# 1. Cargar variables
with open("local.settings.json", 'r') as f:
    for k, v in json.load(f).get("Values", {}).items():
        os.environ[k] = v

# 2. Inicializar Memoria y Cliente OpenAI (Chat)
memory = LabMemory()
chat_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT").strip(), # El de Suecia
    api_key=os.getenv("AZURE_OPENAI_KEY").strip(),             # Llave de Suecia
    api_version="2024-05-01-preview"
)
deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME").strip() # "gpt-4o"

print("Buscando en la memoria del laboratorio...")
prompt_nuevo = "Quiero probar la Enzima X a 50°C para acelerar la reacción."

# 3. Recuperar el pasado
contexto_pasado = memory.search_similar_experiments(prompt_nuevo)
print(f"Contexto encontrado:\n{contexto_pasado}\n")

# 4. Que la IA razone
print("Analizando riesgo con GPT-4o...")
respuesta = chat_client.chat.completions.create(
    model=deployment_name,
    messages=[
        {"role": "system", "content": "Eres un supervisor de laboratorio científico. Revisa el historial de experimentos para advertir de peligros. Sé directo y profesional."},
        {"role": "user", "content": f"Historial:\n{contexto_pasado}\n\nPropuesta Nueva:\n{prompt_nuevo}\n\n¿Deberíamos proceder?"}
    ]
)

print(f"\nRESPUESTA DEL AGENTE:\n{respuesta.choices[0].message.content}")