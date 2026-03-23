import azure.durable_functions as df
import os
import json
import uuid
from openai import AzureOpenAI
from services.memory_manager import LabMemory 

bp = df.Blueprint()

@bp.activity_trigger(input_name="reasoningProposal")
def agent_safety_supervisor(reasoningProposal: str) -> dict:
    
    client = AzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"), 
        api_key=os.getenv("AZURE_OPENAI_KEY"), 
        api_version="2024-02-15-preview"
    )
    
    memory = LabMemory()

    # 2. Configurar el System Prompt de Supervisión
    system_prompt = """Eres el Agente Supervisor de Bioseguridad y Cumplimiento Ético.
                        Revisa la propuesta generada por el Agente Científico.
                        Si la propuesta viola políticas de bioseguridad, usa patógenos prohibidos, toxinas, o cruza la línea dando "asesoramiento definitivo" en lugar de sugerencias, DEBES BLOQUEARLA.

                        Responde ÚNICAMENTE con un JSON válido en este formato:
                        {
                        "status": "APPROVED" | "HARD_BLOCK",
                        "explanation": "Breve explicación de por qué fue aprobado o bloqueado según normas de compliance."
                        }"""

    # 3. Evaluar la propuesta con AI
    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        response_format={ "type": "json_object" }, 
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Evalúa esta propuesta:\n{reasoningProposal}"}
        ]
    )
    
    evaluation = json.loads(response.choices[0].message.content)

    # 4. PASO DE ESCRITURA EN MEMORIA (RAG)
    # Solo guardamos en la memoria a largo plazo si la propuesta es SEGURA y APROBADA
    if evaluation.get("status") == "APPROVED":
        try:
            print(f"[Supervisor] Propuesta aprobada. Guardando en memoria de largo plazo...")
            experiment_id = str(uuid.uuid4())
            
            # Guardamos en Azure AI Search para que el Agente de Razonamiento pueda consultarlo en el futuro
            memory.store_memory(
                experiment_id=experiment_id,
                prompt="Propuesta de experimentación científica analizada",
                recommendation=reasoningProposal,
                status="Aprobado"
            )
        except Exception as e:
            print(f"[Error de Memoria] No se pudo guardar el experimento: {str(e)}")
    else:
        print(f"[Supervisor] Propuesta BLOQUEADA. No se registrará en la memoria de éxitos.")

    return evaluation