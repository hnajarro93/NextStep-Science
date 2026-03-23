import azure.durable_functions as df
import os
from openai import AzureOpenAI
from services.memory_manager import LabMemory 

bp = df.Blueprint()

@bp.activity_trigger(input_name="statisticalTrends")
def agent_scientific_reasoning(statisticalTrends: str) -> str:
    # 1. Inicializar Clientes
    client = AzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"), 
        api_key=os.getenv("AZURE_OPENAI_KEY"), 
        api_version="2024-02-15-preview"
    )

    memory = LabMemory()

    # 2. PASO RAG: Consultar Memoria a Largo Plazo
    # Usamos las tendencias actuales como query para buscar en el pasado.
    print(f"[Reasoning Agent] Consultando historial para: {statisticalTrends[:50]}...")
    past_experiments_context = memory.search_similar_experiments(query_text=statisticalTrends)

    # Preparar el fragmento de texto para el prompt
    if not past_experiments_context.strip():
        memory_section = "No se encontraron experimentos pasados relevantes en el historial."
    else:
        memory_section = past_experiments_context

    # 3. Definir System Prompt Actualizado con Memoria
    system_prompt = f"""[SYSTEM PROMPT - AGENTE DE RAZONAMIENTO CON MEMORIA]
                        Eres un Asistente de Cuaderno de Laboratorio de nivel experto. Tu rol es actuar como un compañero de debate para investigadores científicos.
                        ### CONTEXTO HISTÓRICO (Memoria del Laboratorio) ###
                        Utiliza la siguiente información de experimentos PASADOS para guiar tus sugerencias actuales. 
                        NO sugieras repetir condiciones que ya fallaron (Status: Fallido) a menos que propongas un cambio drástico. 
                        Básate en los éxitos (Status: Aprobado) para iterar.

                        {memory_section}

                        ##############################################
                        REGLAS ESTRICTAS DE COMPORTAMIENTO:
                        1. NUNCA tomes decisiones finales ni afirmes que una hipótesis es un hecho comprobado. Usa lenguaje probabilístico (ej: "esto sugiere", "podría indicar").
                        2. Tu objetivo es estimular el pensamiento crítico del investigador, no reemplazarlo.
                        3. Debes explicar tu razonamiento científico paso a paso antes de dar una conclusión preliminar.
                        4. Si un protocolo involucra patógenos, toxinas o manipulación genética no estándar, detén el análisis inmediatamente y emite una advertencia de bioseguridad.

                        FORMATO DE SALIDA REQUERIDO:
                        - **Análisis del Historial:** (Breve comentario sobre cómo el pasado afecta lo que sugerirás hoy).
                        - **Observaciones de los Datos Actuales:** (Qué muestran los datos crudos provistos por el analista).
                        - **Razonamiento Científico:** (Por qué estas métricas son relevantes, conectando teoría y datos).
                        - **Sugerencias de Variación (Máximo 3):** (Parámetros específicos a ajustar para el próximo experimento).
                        - **Pregunta Abierta:** (Termina siempre con una pregunta provocativa dirigida al investigador)."""

    # 4. Llamada a Azure OpenAI
    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Genera los escenarios basados en este reporte del analista:\n{statisticalTrends}"}
        ],
        temperature=0.2 # menos creatividad, más enfoque científico
    )
    
    return response.choices[0].message.content