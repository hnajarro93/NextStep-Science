import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { Data } from '../../services/data';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements AfterViewChecked {

  // Elemento para autoscroll
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  //Variables globales
  userInput: string = '';
  chatHistory: any[] = [
    { role: 'assistant', text: 'Hola, soy tu asistente. ¿En qué puedo ayudarte?' }
  ];
  isTyping: boolean = false;

  constructor(private dataService: Data){}

  // Logica de autoscroll
  ngAfterViewChecked(): void {
    try{
      setTimeout(() =>
      {
        this.myScrollContainer.nativeElement.scrollTop = 
            this.myScrollContainer.nativeElement.scrollHeight;
      }, 0);
    } catch(err){ }
  }

  onSendMessage(){
    if (!this.userInput.trim()) return;

    // 1. Agregar mensaje del usuario a la lista
    this.chatHistory.push({ role: 'user', text: this.userInput });
    const tempMessage = this.userInput;
    this.userInput = ''; //Limpiar Input
    this.isTyping = true;

    // 2. Llamamos al servicio
    this.dataService.sendMessage(tempMessage).subscribe({
      next: (res) => {
        this.chatHistory.push({ role: 'assistant', text: res.response });
        this.isTyping = false;
      },
      error: (err) => {
        console.error('Error en la comunicación', err);
        this.isTyping = false;
      }
    });
  }

}
