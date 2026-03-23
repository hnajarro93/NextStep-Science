import azure.durable_functions as df
import os
import json
import uuid
import requests
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

bp = df.Blueprint()

def execute_in_dynamic_session(script: str, csv_data: str) -> str:
    """
    Simula un Sandbox seguro.
    Sube los datos y ejecuta el script generado por la IA en 
    Azure Container Apps Dynamic Sessions.
    """
    # 1. Configuración de endpoint
    session_pool_endpoint = os.getenv("ACA_SESSION_POOL_ENDPOINT")
    
    # 2. Autenticación con Entra ID usando Managed Identity o tu usuario local
    credential = DefaultAzureCredential()
    token = credential.get_token("https://acasessions.io/.default").token
    
    # Generamos un ID de sesión único para aislar esta ejecución
    session_id = str(uuid.uuid4())
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    params = {"api-version": "2024-02-02-preview", "identifier": session_id}

    try:
        # 3. Subir el CSV al entorno aislado
        upload_url = f"{session_pool_endpoint}/files/upload"
        files = {
            'file': ('data.csv', csv_data, 'text/csv')
        }
        # Requests maneja el Content-Type para archivos, solo pasamos la auth
        upload_headers = {"Authorization": f"Bearer {token}"}
        
        upload_resp = requests.post(upload_url, headers=upload_headers, params=params, files=files)
        upload_resp.raise_for_status()

        # 4. Inyectar la carga del CSV en el script del LLM
        # los archivos subidos están en /mnt/data/
        setup_code = "import pandas as pd\nimport json\ndf = pd.read_csv('/mnt/data/data.csv')\n"
        final_script = setup_code + script

        # 5. Ejecutar el código en el Sandbox
        execute_url = f"{session_pool_endpoint}/code/execute"
        payload = {
            "properties": {
                "codeInputType": "inline",
                "executionType": "synchronous",
                "code": final_script
            }
        }
        
        exec_resp = requests.post(execute_url, headers=headers, params=params, json=payload)
        exec_resp.raise_for_status()
        
        # 6. Capturar resultados de stdout o errores
        result_json = exec_resp.json()
        properties = result_json.get("properties", {})
        stdout = properties.get("stdout", "")
        error = properties.get("stderr", "")
        
        if error:
            return f"Error en la ejecución del script (stderr): {error}"
            
        return stdout if stdout else "El script se ejecutó, pero no usó print()."

    except Exception as e:
        return f"Error crítico con Dynamic Sessions: {str(e)}"

@bp.activity_trigger(input_name="rawData")
def agent_data_analyst(rawData: str) -> str:
    client = AzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"), 
        api_key=os.getenv("AZURE_OPENAI_KEY"), 
        api_version="2024-02-15-preview"
    )
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    
    # Prompt ajustado para los límites de seguridad del laboratorio
    system_prompt = """Eres un Asistente de Cuaderno de Laboratorio basado en IA.
                        Tu objetivo es ayudar a los investigadores a razonar sobre los datos experimentales, NO reemplazar su juicio científico.
                        
                        REGLAS ESTRICTAS DE SEGURIDAD:
                        1. NO proporciones asesoramiento médico, clínico o diagnósticos definitivos.
                        2. NO apruebes ni valides la seguridad de protocolos biológicos. 
                        3. Si los datos sugieren un riesgo fuera de lo normal, incluye una advertencia explícita.
                        
                        TUS TAREAS:
                        1. TIENES UNA HERRAMIENTA llamada `execute_in_dynamic_session`.
                        2. Escribe código en Python (pandas) para analizar los datos. El DataFrame YA ESTÁ CARGADO en la variable `df`.
                        3. EXPLICABILIDAD: Explica qué prueba vas a realizar y por qué.
                        4. Usa `print()` para devolver los resultados.
                        5. Redacta el reporte final recordando que tus resultados deben ser validados por el investigador principal.
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Analiza estos resultados del experimento:\n{rawData[:500]}..."}
    ]

    tools = [
        {
            "type": "function",
            "function": {
                "name": "execute_in_dynamic_session",
                "description": "Ejecuta código Python en un sandbox seguro. El DataFrame ya existe en la variable `df`.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "script": {
                            "type": "string",
                            "description": "Código Python a ejecutar. Omite la carga de datos. Ejemplo: print(df.describe())"
                        }
                    },
                    "required": ["script"]
                }
            }
        }
    ]

    response = client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )
    
    response_message = response.choices[0].message
    tool_calls = response_message.tool_calls

    if tool_calls:
        messages.append(response_message)
        
        for tool_call in tool_calls:
            if tool_call.function.name == "execute_in_dynamic_session":
                function_args = json.loads(tool_call.function.arguments)
                python_code = function_args.get("script")
                
                # Ejecutamos en ACA
                execution_result = execute_in_dynamic_session(python_code, rawData)
                
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": "execute_in_dynamic_session",
                    "content": execution_result
                })
                
        final_response = client.chat.completions.create(
            model=deployment_name,
            messages=messages
        )
        return final_response.choices[0].message.content

    return response_message.content