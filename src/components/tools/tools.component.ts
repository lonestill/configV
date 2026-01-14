import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ToolType = 'uuid' | 'base64' | 'color';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full bg-gray-950 text-gray-200">
      <!-- Tools Sidebar -->
      <div class="w-48 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col">
        <div class="p-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Utilities</div>
        <nav class="flex-1 px-2 space-y-1">
          <button (click)="activeTool.set('uuid')" 
                  [class.bg-blue-600.text-white]="activeTool() === 'uuid'"
                  [class.text-gray-400.hover:bg-gray-800.hover:text-white]="activeTool() !== 'uuid'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 15.5v.01"></path><path d="M12 12v.01"></path><path d="M11 17v.01"></path><path d="M7 14v.01"></path></svg>
            UUID Generator
          </button>
          
          <button (click)="activeTool.set('base64')" 
                  [class.bg-blue-600.text-white]="activeTool() === 'base64'"
                  [class.text-gray-400.hover:bg-gray-800.hover:text-white]="activeTool() !== 'base64'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
            Base64 Encoder
          </button>
          
          <button (click)="activeTool.set('color')" 
                  [class.bg-blue-600.text-white]="activeTool() === 'color'"
                  [class.text-gray-400.hover:bg-gray-800.hover:text-white]="activeTool() !== 'color'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>
            Color Converter
          </button>
        </nav>
      </div>

      <!-- Content Area -->
      <div class="flex-1 p-8 overflow-y-auto">
        
        <!-- UUID Generator -->
        @if (activeTool() === 'uuid') {
          <div class="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              UUID Generator (v4)
            </h2>
            <div class="p-6 bg-gray-900 rounded-lg border border-gray-800 shadow-xl">
              <div class="flex gap-4 items-end mb-4">
                 <div class="flex-1">
                   <label class="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                   <input type="number" [(ngModel)]="uuidCount" min="1" max="100" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors">
                 </div>
                 <button (click)="generateUuids()" class="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded text-sm transition-colors">Generate</button>
              </div>
              
              <div class="relative">
                <textarea readonly [value]="uuidResult()" class="w-full h-64 bg-gray-950 border border-gray-800 rounded p-4 font-mono text-sm text-green-400 focus:outline-none resize-none"></textarea>
                <button (click)="copyToClipboard(uuidResult())" class="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors" title="Copy">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Base64 -->
        @if (activeTool() === 'base64') {
          <div class="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <h2 class="text-xl font-bold text-white">Base64 Converter</h2>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Encode -->
                <div class="space-y-2">
                   <div class="flex justify-between items-center">
                     <label class="text-xs font-bold text-gray-500 uppercase">Text Input</label>
                     <button (click)="clearBase64()" class="text-xs text-red-400 hover:underline">Clear</button>
                   </div>
                   <textarea [(ngModel)]="base64Plain" (ngModelChange)="encodeBase64()" placeholder="Type text here..." class="w-full h-64 bg-gray-900 border border-gray-800 rounded p-3 font-mono text-sm text-gray-300 focus:border-blue-500 outline-none resize-none"></textarea>
                </div>

                <!-- Decode -->
                <div class="space-y-2">
                   <label class="text-xs font-bold text-gray-500 uppercase">Base64 Output</label>
                   <textarea [(ngModel)]="base64Encoded" (ngModelChange)="decodeBase64()" placeholder="Result..." class="w-full h-64 bg-gray-900 border border-gray-800 rounded p-3 font-mono text-sm text-blue-300 focus:border-blue-500 outline-none resize-none"></textarea>
                </div>
             </div>
          </div>
        }

        <!-- Color Converter -->
        @if (activeTool() === 'color') {
           <div class="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <h2 class="text-xl font-bold text-white">Color Converter</h2>
             
             <div class="p-6 bg-gray-900 rounded-lg border border-gray-800 shadow-xl flex gap-6 items-start">
                <div class="space-y-2">
                   <label class="block text-xs font-bold text-gray-500 uppercase">Picker</label>
                   <input type="color" [(ngModel)]="colorHex" (ngModelChange)="updateColorFromHex()" class="w-24 h-24 rounded cursor-pointer border-none bg-transparent">
                </div>
                
                <div class="flex-1 space-y-4">
                   <div>
                      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">HEX</label>
                      <div class="flex">
                         <span class="inline-flex items-center px-3 rounded-l border border-r-0 border-gray-700 bg-gray-800 text-gray-400 text-sm">#</span>
                         <input type="text" [(ngModel)]="colorHexClean" (ngModelChange)="updateColorFromHexInput()" class="flex-1 bg-gray-950 border border-gray-700 rounded-r px-3 py-2 text-sm font-mono text-white focus:border-blue-500 outline-none uppercase" maxlength="6">
                      </div>
                   </div>

                   <div>
                      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">RGB</label>
                      <div class="grid grid-cols-3 gap-2">
                         <input type="number" [(ngModel)]="colorR" (ngModelChange)="updateColorFromRgb()" min="0" max="255" class="bg-gray-950 border border-gray-700 rounded px-2 py-2 text-sm font-mono text-red-400 focus:border-red-500 outline-none text-center">
                         <input type="number" [(ngModel)]="colorG" (ngModelChange)="updateColorFromRgb()" min="0" max="255" class="bg-gray-950 border border-gray-700 rounded px-2 py-2 text-sm font-mono text-green-400 focus:border-green-500 outline-none text-center">
                         <input type="number" [(ngModel)]="colorB" (ngModelChange)="updateColorFromRgb()" min="0" max="255" class="bg-gray-950 border border-gray-700 rounded px-2 py-2 text-sm font-mono text-blue-400 focus:border-blue-500 outline-none text-center">
                      </div>
                   </div>
                   
                   <div>
                      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">CSS Output</label>
                      <div class="relative">
                         <input readonly [value]="'rgb(' + colorR + ', ' + colorG + ', ' + colorB + ')'" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-400 focus:outline-none">
                         <button (click)="copyToClipboard('rgb(' + colorR + ', ' + colorG + ', ' + colorB + ')')" class="absolute right-1 top-1 p-1 hover:text-white text-gray-500">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                         </button>
                      </div>
                   </div>
                </div>
             </div>
           </div>
        }
      </div>
    </div>
  `
})
export class ToolsComponent {
  activeTool = signal<ToolType>('uuid');

  // UUID State
  uuidCount = 5;
  uuidResult = signal<string>('');
  
  // Base64 State
  base64Plain = '';
  base64Encoded = '';
  
  // Color State
  colorHex = '#3b82f6';
  colorHexClean = '3b82f6';
  colorR = 59;
  colorG = 130;
  colorB = 246;

  constructor() {
    this.generateUuids(); // Init
  }

  // --- UUID Logic ---
  generateUuids() {
    let res = '';
    const count = Math.min(Math.max(this.uuidCount, 1), 1000);
    for(let i=0; i<count; i++) {
      res += crypto.randomUUID() + '\n';
    }
    this.uuidResult.set(res.trim());
  }

  // --- Base64 Logic ---
  encodeBase64() {
    try {
      this.base64Encoded = btoa(this.base64Plain);
    } catch (e) {
      // ignore partial input errors
    }
  }

  decodeBase64() {
    try {
      this.base64Plain = atob(this.base64Encoded);
    } catch (e) {
      // ignore errors
    }
  }
  
  clearBase64() {
    this.base64Plain = '';
    this.base64Encoded = '';
  }

  // --- Color Logic ---
  updateColorFromHex() {
     this.colorHexClean = this.colorHex.substring(1);
     this.hexToRgb(this.colorHexClean);
  }

  updateColorFromHexInput() {
     if (this.colorHexClean.length === 6) {
        this.colorHex = '#' + this.colorHexClean;
        this.hexToRgb(this.colorHexClean);
     }
  }

  updateColorFromRgb() {
     const r = Math.min(255, Math.max(0, this.colorR));
     const g = Math.min(255, Math.max(0, this.colorG));
     const b = Math.min(255, Math.max(0, this.colorB));
     
     const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
     };
     
     this.colorHexClean = toHex(r) + toHex(g) + toHex(b);
     this.colorHex = '#' + this.colorHexClean;
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        this.colorR = parseInt(result[1], 16);
        this.colorG = parseInt(result[2], 16);
        this.colorB = parseInt(result[3], 16);
    }
  }

  // Util
  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
}
