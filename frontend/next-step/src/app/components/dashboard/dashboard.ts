import { Component, ElementRef, ViewChild } from '@angular/core';
import { AnalysisResponse, Data } from '../../services/data';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})

export class Dashboard {

  ngOnInit() {
  // Evita que el navegador abra archivos si se sueltan fuera de la zona
  window.addEventListener('dragover', (e) => e.preventDefault(), false);
  window.addEventListener('drop', (e) => e.preventDefault(), false);
}

  // Elemento para autoscroll
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  //Variables globales
  userInput: string = '';
  chatHistory: any[] = [
    { role: 'assistant', text: 'Hola, soy tu asistente. ¿En qué puedo ayudarte?' }
  ];
  isTyping: boolean = false;
  agentThought: string = 'Bienvenido, colega. Sube un manual o un diagrama para comenzar el análisis.';

  // Estados para el badge y estados de carga
  public analysisFailed: boolean = false;
  public lastBlobUploaded?: any;
  public systemStatus: 'safe' | 'warning' | 'error' | 'analyzing' = 'safe';
  public analysisResult: any = null;

  // Estados para el archivo PDF
  isDraggingPDF = false;
  selectedPDFName: string | null = null;
  isUploadingPDF = false;
  PDFAzureUrl: string = '';  //Almacena la url de Azure
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

  public AnalysisResult?: AnalysisResponse; 
  
  //Estadp para el boton de envio
   showConfirmButtons = false;


  constructor(private dataService: Data){}

  //Funcion para scroll hacia el fondo
  scrollToBottom(): void {
    try {
      setTimeout(() => {
        if (this.myScrollContainer) {
          this.myScrollContainer.nativeElement.scrollTo({
            top: this.myScrollContainer.nativeElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100); //100 ms para esperar el render
    } catch (err) {}
  }  

  //Funcion para envio de mensajes
 onSendMessage() {
    if (!this.userInput.trim()) return;

    // 1. Agregar mensaje del usuario a la lista
    const tempMessage = this.userInput;
    this.chatHistory.push({ role: 'user', text: tempMessage });
    
    this.userInput = ''; // Limpiar Input
    this.isTyping = true;
    this.scrollToBottom();

    // 2. Llamamos al servicio (Usando el nuevo método analyzeText)
    this.dataService.analyzeText(tempMessage).subscribe({
      next: (res) => {
        // Mapeamos 'experiment_summary' que es donde viene la respuesta del Agent
        this.chatHistory.push({ 
          role: 'assistant', 
          text: res.experiment_summary 
        });
        
        this.isTyping = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error en la comunicación', err);
        this.isTyping = false;
        
        this.chatHistory.push({ 
          role: 'assistant', 
          text: 'Lo siento, hubo un problema al conectar con el laboratorio. Revisa la consola.' 
        });
        
        this.scrollToBottom();
      }
    });
  }

onDragOver(event: DragEvent, type: string){
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
    event.preventDefault(); // <--- Detiene la apertura del PDF
    event.stopPropagation();
    this.onDragLeave(type);
    
    this.onDragLeave(type); // Quitamos el color azul del borde

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
        const file = files[0];
        const fileName = file.name.toLowerCase();
        const fileType = file.type; // Ejemplo: 'application/pdf' o 'image/png'
        // En lugar de subirlo, lo guardamos en "espera"

        // Logica de valicacion
        let isValid = false;

        if (type === 'pdf' && (fileType === 'application/pdf' || fileName.endsWith('.pdf'))) {
          isValid = true;
        } else if (type === 'img' && (fileType.startsWith('image/') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))) {
          isValid = true;
        } else if (type === 'csv' && (fileType === 'text/csv' || fileName.endsWith('.csv'))) {
          isValid = true;
        }

        // Resultado de la validacion
        if (isValid) {
          if (type === 'pdf') {  this.tempPDFFile = file; this.selectedPDFName = file.name;  }
          else if (type === 'img') {  this.tempIMGFile = file; this.selectedIMGName = file.name;  }
          else if (type === 'csv') {  this.tempCSVFile = file; this.selectedCSVName = file.name;  }
          
          this.showConfirmButtons = true;
          this.agentThought = `Archivo ${file.name} detectado correctamente. ¿Confirmas la subida o prefieres revertir?`
        } else {
          this.agentThought = `¡Cuidado, colega! Estás intentando subir un archivo que no es ${type.toUpperCase()} en esta zona.`;
          console.warn(`Intento de subida inválido: Se esperaba ${type} pero se recibió ${file.name}`);
          setTimeout(() => {
            if (this.agentThought.includes("Cuidado")) {
              this.agentThought = "Esperando un archivo válido para continuar...";
            }
          }, 4000);
        }
      }
}

// NUEVO: Función para el botón de "Revertir"
revertUpload(type: 'pdf' | 'img' | 'csv') {
    if (type === 'pdf') {
        this.tempPDFFile = null;
        this.selectedPDFName = null;
    } else if (type === 'img'){
        this.tempIMGFile = null;
        this.selectedIMGName = null;
    } else if (type === 'csv'){
      this.tempCSVFile = null;
      this.selectedCSVName = null;
    }
    this.showConfirmButtons = false;
    this.agentThought = "Archivo descartado. El sistema sigue esperando un documento válido.";
}

// NUEVO: Función para el botón de "Confirmar"
confirmUpload(type: 'pdf' | 'img' | 'csv') {
    //Identificamos qué archivo temporal usar según el tipo
    let fileToUpload: File | null = null;
    
    if (type === 'pdf') fileToUpload = this.tempPDFFile;
    else if (type === 'img') fileToUpload = this.tempIMGFile;
    else if (type === 'csv') fileToUpload = this.tempCSVFile;
    
    // Si existe el archivo, procedemos con la subida real
    if (fileToUpload) {
      this.showConfirmButtons = false; //Oculta los botones de Confirmar/Revertir

      // Llamamos al metodo que conecta con el servicio
      this.processUpload(fileToUpload, type);
    } else {
      console.error(`No se encontró un archivo temporal para el tipo: ${type}`);
      this.agentThought = "Error interno: El archivo desapareció de la memoria. Intenta subirlo de nuevo.";
  }
    
}



private processUpload(file: File, type: 'pdf' | 'img' | 'csv' ) {
  const backendType: 'pdf' | 'csv' | 'image' = type === 'img' ? 'image' : type; 
  // 1. Activamos el spinner correspondiente
  if (type === 'pdf') this.isUploadingPDF = true;
  else if (type === 'img') this.isUploadingIMG = true;
  else if (type === 'csv') this.isUploadingCSV = true;

  this.systemStatus = 'analyzing'; // Badge en modo "Analizando..."
  this.analysisFailed = false;     // Limpiamos errores previos
  this.agentThought = `Subiendo ${file.name} al laboratorio virtual...`;

  // 2. Subida del archivo binario
  this.dataService.uploadFile(file).subscribe({
    next: (uploadRes) => {
      // GUARDAMOS EL BLOB PARA EL PLAN B (REINTENTOS)
      this.lastBlobUploaded = { ...uploadRes, input_type: backendType };
      console.log('Subida exitosa, iniciando análisis:', uploadRes);
      this.agentThought = `Archivo en Azure. Iniciando análisis científico de ${type.toUpperCase()}...`;

      // 2.1 Analisis automatico usando blob_name recibido
      this.dataService.analyzeFile(backendType, uploadRes.blob_name).subscribe({
        next: (analysisRes) => {
          //Guardamos resultado para el dashboard
          this.AnalysisResult = analysisRes; 
          this.systemStatus = 'safe';  
          //Apagamos spinners y actualizamos UI
          this.finalizeUpload(type, file.name, uploadRes.file_url);

          this.agentThought = `Análisis completado. He generado un resumen del experimento y evaluado los riesgos.`;
        },
        error: (err) => {
          this.analysisFailed = true; // ACTIVAMOS BOTÓN DE REINTENTAR
          this.systemStatus = 'error'; // Badge en rojo
          this.handleUploadError(type, 'error en el análisis científico (Credenciales Azure)');
        }
      });
    }, 
    error: (err) => {
      this.analysisFailed = false; // Si falló el upload, no hay blob para reintentar
      this.systemStatus = 'error';
      this.handleUploadError(type, 'error de conexión con Azure');
    }
  });
      
}

// Método auxiliar para limpiar el código y no repetir lógica de apagado
private finalizeUpload(type: string, fileName: string, url: string) {
  this.isUploadingPDF = false;
  this.isUploadingIMG = false;
  this.isUploadingCSV = false;

  if (type === 'pdf') { this.selectedPDFName = fileName; this.PDFAzureUrl = url; }
  else if (type === 'img') { this.selectedIMGName = fileName; this.IMGAzureUrl = url; }
  else if (type === 'csv') { this.selectedCSVName = fileName; this.CSVAzureUrl = url; }
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
  this.agentThought = "Reintentando análisis con el archivo existente en Azure...";

  // Llamamos directamente al análisis usando el blob_name que ya teníamos guardado
  this.dataService.analyzeFile(this.lastBlobUploaded.input_type, this.lastBlobUploaded.blob_name).subscribe({
    next: (analysisRes) => {
      this.analysisResult = analysisRes;
      this.systemStatus = 'safe';
      this.agentThought = "Análisis completado exitosamente tras el reintento.";
      
      // Apagamos cualquier spinner que pudiera estar prendido
      this.isUploadingPDF = this.isUploadingIMG = this.isUploadingCSV = false;
    },
    error: (err) => {
      this.analysisFailed = true;
      this.systemStatus = 'error';
      this.agentThought = "El análisis falló de nuevo. El servidor sigue sin acceso a las credenciales.";
    }
  });
}
}


