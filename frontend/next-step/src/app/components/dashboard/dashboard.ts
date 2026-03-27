import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AnalysisResponse, Data, UploadResponse, NextStep } from '../../services/data';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  constructor(private dataService: Data) {}

  ngOnInit() {
    // Evita que el navegador abra archivos si se sueltan fuera de la zona
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
  }

  // Elemento para autoscroll
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  //Variables globales
  userInput: string = '';
  chatHistory: { role: 'user' | 'assistant'; text: string }[] = [
    { role: 'assistant', text: 'Hola, soy tu asistente. ¿En qué puedo ayudarte?' },
  ];
  isTyping: boolean = false;
  agentThought: string =
    'Bienvenido, colega. Sube un manual o un diagrama para comenzar el análisis.';

  // Estados del Sistema
  public analysisFailed: boolean = false;
  public systemStatus: 'safe' | 'warning' | 'error' | 'analyzing' = 'safe';

  // UNIFICADO: Usamos solo esta para los resultados del análisis
  public analysisResultData?: AnalysisResponse;

  // En la zona de variables globales
  public lastBlobUploaded?: {
    blob_name: string;
    input_type: 'pdf' | 'csv' | 'image';
    file_url: string;
  };

  // Estados para el archivo PDF
  isDraggingPDF = false;
  selectedPDFName: string | null = null;
  isUploadingPDF = false;
  PDFAzureUrl: string = '';
  tempPDFFile: File | null = null;

  // Estados para la Imagen
  isDraggingIMG = false;
  isUploadingIMG = false;
  selectedIMGName: string | null = null;
  IMGAzureUrl: string = '';
  tempIMGFile: File | null = null;

  // Estados para el Dataset (CSV)
  isDraggingCSV = false;
  isUploadingCSV = false;
  selectedCSVName: string | null = null;
  CSVAzureUrl: string = '';
  tempCSVFile: File | null = null;

  showConfirmButtons = false;

  public isPDFConfirmed = false;
  public isIMGConfirmed = false;
  public isCSVConfirmed = false;

  //Funcion para scroll hacia el fondo
  scrollToBottom(): void {
    try {
      setTimeout(() => {
        if (this.myScrollContainer) {
          this.myScrollContainer.nativeElement.scrollTo({
            top: this.myScrollContainer.nativeElement.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100); //100 ms para esperar el render
    } catch (err) {}
  }

  //Funcion para envio de mensajes
  onSendMessage() {
  // 1. Validación de seguridad: no enviar si está vacío o si ya está cargando
  if (!this.userInput.trim() || this.isTyping) return;

  const tempMessage = this.userInput;
  
  // 2. UI: Agregamos el mensaje del usuario al chat
  this.chatHistory.push({ role: 'user', text: tempMessage });
  this.userInput = '';
  this.isTyping = true;
  this.scrollToBottom();

  // 3. REFUERZO: Creamos un prompt que obligue a la IA a analizar, no solo repetir
  // Esto ayuda a que el modelo entienda que debe ser un asistente científico.
  const finalPrompt = `Analiza lo siguiente basándote en los archivos cargados: ${tempMessage}`;

  // 4. Llamada al servicio con debugging
  this.dataService.analyze({
    type: 'text',
    text: finalPrompt,
    // Aseguramos que tome el ID de la sesión actual del servicio
    session_id: (this.dataService as any).currentSessionId 
  }).subscribe({
next: (res: AnalysisResponse) => {
  console.log('Respuesta completa del server:', res);

  // 1. Construimos una respuesta enriquecida
  let fullResponse = '';

  if (res.analysis) {
    fullResponse = res.analysis;
  } else if (res.observations_and_analysis) {
    // Si el backend manda el formato de reporte, lo unimos para el chat
    fullResponse = `
      <b>Análisis Técnico:</b><br>${res.observations_and_analysis}<br><br>
      <b>Evaluación de Seguridad:</b><br>${res.safety_assessment}
    `;
    
    // Si quieres mostrar también los consejos:
    if (res.next_steps && res.next_steps.length > 0) {
      fullResponse += `<br><br><b>Sugerencias:</b><ul>`;
      res.next_steps.forEach(step => {
        fullResponse += `<li>${step.suggestion}</li>`;
      });
      fullResponse += `</ul>`;
    }
  } else {
    fullResponse = res.experiment_summary || 'Análisis completado.';
  }

  // 2. Insertamos en la UI
  this.chatHistory.push({
    role: 'assistant',
    text: fullResponse
  });

  this.isTyping = false;
  this.scrollToBottom();
},
    error: (err: any) => {
      console.error('Error en el flujo del chat:', err);
      this.isTyping = false;
      this.chatHistory.push({
        role: 'assistant',
        text: 'Error de comunicación con el laboratorio virtual. Verifica tu conexión.'
      });
      this.scrollToBottom();
    }
  });
}

  onDragOver(event: DragEvent, type: string) {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'pdf') this.isDraggingPDF = true;
    else if (type === 'img') this.isDraggingIMG = true;
    else if (type === 'csv') this.isDraggingCSV = true;
  }

  onDragLeave(type: string) {
    if (type === 'pdf') this.isDraggingPDF = false;
    else if (type === 'img') this.isDraggingIMG = false;
    else if (type === 'csv') this.isDraggingCSV = false;
  }

  onDrop(event: DragEvent, type: 'pdf' | 'img' | 'csv') {
    event.preventDefault();
    event.stopPropagation();
    this.onDragLeave(type); // Quitamos el color azul del borde

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileName = file.name.toLowerCase();
      const fileType = file.type;

      let isValid = false;

      // Validaciones (Tu lógica está perfecta aquí)
      if (type === 'pdf' && (fileType === 'application/pdf' || fileName.endsWith('.pdf'))) {
        isValid = true;
      } else if (
        type === 'img' &&
        (fileType.startsWith('image/') ||
          fileName.endsWith('.png') ||
          fileName.endsWith('.jpg') ||
          fileName.endsWith('.jpeg'))
      ) {
        isValid = true;
      } else if (type === 'csv' && (fileType === 'text/csv' || fileName.endsWith('.csv'))) {
        isValid = true;
      }

      if (isValid) {
        // PASO CLAVE: Antes de asignar el nuevo, "limpiamos" el estado anterior de esa zona
        if (type === 'pdf') {
          this.tempPDFFile = file;
          this.selectedPDFName = file.name;
          this.isPDFConfirmed = false; // Reiniciamos por si había uno previo confirmado
        } else if (type === 'img') {
          this.tempIMGFile = file;
          this.selectedIMGName = file.name;
          this.isIMGConfirmed = false;
        } else if (type === 'csv') {
          this.tempCSVFile = file;
          this.selectedCSVName = file.name;
          this.isCSVConfirmed = false;
        }

        // Ya no necesitamos depender obligatoriamente de showConfirmButtons para el HTML,
        // pero lo dejamos en true por si tienes alguna otra lógica global.
        this.showConfirmButtons = true;
        this.agentThought = `Archivo ${file.name} detectado correctamente. ¿Confirmas la subida o prefieres revertir?`;
      } else {
        this.agentThought = `¡Cuidado, colega! Estás intentando subir un archivo que no es ${type.toUpperCase()} en esta zona.`;
        // ... resto de tu lógica de error ...
      }
    }
  }

  // NUEVO: Función para el botón de "Revertir"
  revertUpload(type: 'pdf' | 'img' | 'csv') {
    if (type === 'pdf') {
      this.tempPDFFile = null;
      this.selectedPDFName = null;
    } else if (type === 'img') {
      this.tempIMGFile = null;
      this.selectedIMGName = null;
    } else if (type === 'csv') {
      this.tempCSVFile = null;
      this.selectedCSVName = null;
    }
    this.showConfirmButtons = false;
    this.agentThought = 'Archivo descartado. El sistema sigue esperando un documento válido.';
  }

  // NUEVO: Función para el botón de "Confirmar"
  confirmUpload(type: 'pdf' | 'img' | 'csv') {
    let fileToUpload: File | null = null;

    // 1. Identificamos el archivo y "limpiamos" su estado temporal
    if (type === 'pdf') {
      fileToUpload = this.tempPDFFile;
      this.tempPDFFile = null; // Lo sacamos de "pendiente"
      this.isPDFConfirmed = true; // Nueva variable para tu HTML
    } else if (type === 'img') {
      fileToUpload = this.tempIMGFile;
      this.tempIMGFile = null;
      this.isIMGConfirmed = true;
    } else if (type === 'csv') {
      fileToUpload = this.tempCSVFile;
      this.tempCSVFile = null;
      this.isCSVConfirmed = true;
    }

    if (fileToUpload) {
      // 2. Ejecutamos la subida
      this.processUpload(fileToUpload, type);

      // Opcional: Si usas una sola variable para botones, la apagamos
      this.showConfirmButtons = false;
    } else {
      console.error(`Error: No hay archivo para ${type}`);
      this.agentThought =
        'Ups, parece que el archivo se perdió. ¿Podrías intentar subirlo de nuevo?';
    }
  }

  onFileSelected(event: any, type: 'pdf' | 'image' | 'csv') {
    const file: File = event.target.files[0];
    if (!file) return;

    this.isTyping = true; // Mostramos que el agente está "pensando"

    // PASO 1: Subir al Blob Storage de Azure
    this.dataService.uploadFile(file).subscribe({
      next: (uploadRes) => {
        console.log('Archivo en Azure:', uploadRes.blob_name);

        // PASO 2: Mandar el blob_name para el análisis científico (Caso A)
        this.dataService
          .analyze({
            type: type,
            blob_name: uploadRes.blob_name,
          })
          .subscribe({
            next: (analysisRes) => {
              // Aquí guardas el reporte completo para el Dashboard
              this.analysisResultData = analysisRes;

              // Opcional: Avisar en el chat que el archivo se procesó
              this.chatHistory.push({
                role: 'assistant',
                text: `He analizado el archivo ${file.name}. ¿Qué deseas saber sobre él?`,
              });

              this.isTyping = false;
              this.scrollToBottom();
            },
          });
      },
      error: (err) => {
        console.error('Error al subir archivo', err);
        this.isTyping = false;
      },
    });
  }

private processUpload(file: File, type: 'pdf' | 'img' | 'csv') {
    const backendType: 'pdf' | 'csv' | 'image' = type === 'img' ? 'image' : type;

    // 1. UI: Activamos spinners
    if (type === 'pdf') this.isUploadingPDF = true;
    else if (type === 'img') this.isUploadingIMG = true;
    else if (type === 'csv') this.isUploadingCSV = true;

    this.systemStatus = 'analyzing';
    this.analysisFailed = false;
    this.agentThought = `Subiendo ${file.name} al laboratorio virtual...`;

    // 2. Subida del archivo (POST /api/upload)
    this.dataService.uploadFile(file).subscribe({
      next: (uploadRes: UploadResponse) => {
        
        // 3. ANÁLISIS (POST /api/analyze)
        // Usamos el getter que creamos en data.ts para recuperar el ID
        const activeSession = this.dataService.currentSessionId;

        this.dataService.analyze({
            type: backendType,
            blob_name: uploadRes.blob_name,
            session_id: activeSession || undefined // Si no hay sesión, se envía undefined (Caso A)
          })
          .subscribe({
            next: (analysisRes: AnalysisResponse) => {
              this.analysisResultData = analysisRes;
              this.systemStatus = 'safe';

              // Finalizamos el estado de la UI
              this.finalizeUpload(type, file.name, uploadRes.file_url);
              
              // Mensaje inteligente según si es el primero o ya había una sesión
              this.agentThought = activeSession 
                ? `¡Logrado! ${file.name} ha sido integrado al análisis científico actual.` 
                : `Primer archivo procesado. El laboratorio está listo para recibir más datos.`;
            },
            error: (err: any) => {
              console.error('Error en análisis:', err);
              this.analysisFailed = true;
              this.systemStatus = 'error';
              this.handleUploadError(type, 'error en el análisis científico');
            },
          });
      },
      error: (err: any) => {
        console.error('Error en subida:', err);
        this.systemStatus = 'error';
        this.handleUploadError(type, 'error de conexión con Azure');
      },
    });
  }

  // Método auxiliar para limpiar el código y no repetir lógica de apagado
  private finalizeUpload(type: string, fileName: string, url: string) {
    this.isUploadingPDF = false;
    this.isUploadingIMG = false;
    this.isUploadingCSV = false;

    if (type === 'pdf') {
      this.selectedPDFName = fileName;
      this.PDFAzureUrl = url;
    } else if (type === 'img') {
      this.selectedIMGName = fileName;
      this.IMGAzureUrl = url;
    } else if (type === 'csv') {
      this.selectedCSVName = fileName;
      this.CSVAzureUrl = url;
    }
  }

  private handleUploadError(type: string, reason: string) {
    this.isUploadingPDF = false;
    this.isUploadingIMG = false;
    this.isUploadingCSV = false;
    this.revertUpload(type as any);
    this.agentThought = `Error: falló debido a ${reason}. Reintenta, por favor.`;
  }

  public onRetryAnalysis() {
    if (!this.lastBlobUploaded) return;

    this.analysisFailed = false;
    this.systemStatus = 'analyzing';
    this.agentThought = 'Reintentando análisis con el archivo existente en Azure...';

    // CAMBIO CLAVE: Usamos .analyze() con el objeto de parámetros
    this.dataService
      .analyze({
        type: this.lastBlobUploaded.input_type,
        blob_name: this.lastBlobUploaded.blob_name,
      })
      .subscribe({
        next: (analysisRes: AnalysisResponse) => {
          // Tipamos la respuesta
          this.analysisResultData = analysisRes; // Usamos la variable unificada
          this.systemStatus = 'safe';
          this.agentThought = 'Análisis completado exitosamente tras el reintento.';

          this.isUploadingPDF = this.isUploadingIMG = this.isUploadingCSV = false;
        },
        error: (err: any) => {
          // Tipamos el error
          console.error('Reintento fallido:', err);
          this.analysisFailed = true;
          this.systemStatus = 'error';
          this.agentThought = 'El análisis falló de nuevo. Revisa la conexión con el servidor.';
        },
      });
  }
}
