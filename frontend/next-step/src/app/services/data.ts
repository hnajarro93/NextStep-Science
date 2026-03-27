import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaz de la Respuesta de Subida
export interface UploadResponse {
  file_url: string;
  input_type: 'csv' | 'pdf' | 'image';
  blob_name: string;
}

// Interfaz para el analisis
export interface AnalysisResponse {
// Campos del reporte (Caso A)
  experiment_summary?: string;
  protocol_or_setup?: string;
  observations_and_analysis?: string;
  next_steps?: NextStep[];
  limitations_and_uncertainties?: string[];
  safety_assessment?: string;
  
  // Campos del Chat y Control (Caso B y C)
  analysis?: string;      // IMPORTANTE: Aquí viene la respuesta de la IA
  session_id?: string;   // IMPORTANTE: Para la persistencia
  response_mode: 'normal' | 'restricted';
  result?: string;
}

// Proximos pasos
export interface NextStep {
  suggestion: string;
  reasoning: string;
}

// Interfaz para enviar datos al analisis
export interface AnalysisInput {
  input_type: 'text' | 'csv' | 'pdf' | 'image';
  text?: string; //Opcional si es solo texto
  blob_name?: string; //Opcional si es archivo
}

// Interfaz para el Health Check
export interface HealthStatus {
  status: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class Data {
  //URL base
  private readonly API_URL = environment.api_URL;

  //ID sesion para que sea persistente
  private sessionId: string | null = null;
  get currentSessionId(): string | null {
  return this.sessionId;
}


  constructor(private http: HttpClient) {}

  //** Salud del sistema
  checkHealth(): Observable<any> {
    return this.http.get(`${this.API_URL}/${environment.health}`);
  }

  // ** Método para resetear el chat si cambian de experimento
  resetSession() {
    this.sessionId = null;
  }

  //** Subida de archivos
  uploadFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.API_URL}/${environment.upload}`, formData);
  }

  // En data.ts
// Cambiamos la firma para que acepte session_id opcionalmente
analyze(params: { 
  type: 'pdf' | 'image' | 'text' | 'csv', 
  blob_name?: string, 
  text?: string,
  session_id?: string // <-- AGREGAR ESTO AQUÍ
}): Observable<AnalysisResponse> {
  
  const body: any = {
    input_type: params.type
  };

  if (params.blob_name) body.blob_name = params.blob_name;
  if (params.text) body.text = params.text;

  // Prioridad: Si viene en params lo usa, si no, usa el del servicio
  const sId = params.session_id || this.sessionId;
  if (sId) {
    body.session_id = sId;
  }

  return this.http.post<AnalysisResponse>(`${this.API_URL}/${environment.analyze}`, body).pipe(
    tap((res: AnalysisResponse) => {
      if (res.session_id) {
        this.sessionId = res.session_id;
        console.log('Sesión vinculada:', this.sessionId);
      }
    })
  );
}

}
