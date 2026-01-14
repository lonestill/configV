import { Component, Input, input, output, signal, computed, effect, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormArray, FormControl, AbstractControl, FormBuilder, Validators } from '@angular/forms';

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

@Component({
  selector: 'app-recursive-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="w-full relative group/field text-sm" 
         [id]="'field-' + path()"
         [class.bg-blue-900.bg-opacity-10]="isHighlighted()"
         [class.ring-1.ring-blue-500.rounded]="isHighlighted()">
      
      <!-- ==================== OBJECT (FormGroup) ==================== -->
      @if (isGroup()) {
        <div class="relative">
          <!-- Indentation Guide -->
          @if (expanded()) {
            <div class="absolute left-[11px] top-8 bottom-0 w-px bg-gray-800 group-hover/field:bg-gray-700 transition-colors z-0"></div>
          }

          <!-- Header Row -->
          <div class="flex items-center py-1.5 group/header -ml-2 pl-2 pr-2 rounded hover:bg-gray-800/50 cursor-pointer transition-colors select-none relative"
               (click)="toggleExpand()">
            
            <!-- Expand Arrow -->
            <div class="mr-2 text-gray-500 transition-transform duration-200 flex items-center justify-center w-4 h-4"
                  [class.rotate-90]="expanded()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            <!-- Label -->
            <div class="flex items-baseline gap-2 flex-1 min-w-0">
               <span class="font-mono font-semibold text-gray-300 tracking-tight truncate" 
                     [class.text-red-400]="hasChildErrors()"
                     [class.text-blue-300]="!hasChildErrors()">
                  <span [class.bg-yellow-500.text-black.px-0.5.rounded-sm]="labelMatches()">{{ label() || 'Root' }}</span>
               </span>
               <span class="text-[10px] font-bold text-gray-600 uppercase tracking-wider bg-gray-800/50 px-1.5 rounded border border-gray-700/50">Object</span>
            </div>
            
            <!-- Actions Toolbar -->
            <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
               <!-- Add Button & Menu -->
               <div class="relative">
                 <button type="button" (click)="toggleAddMenu($event)" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400 transition-colors" title="Add Property">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                 </button>
                 
                 <!-- Type Selection Menu -->
                 @if (showAddMenu()) {
                   <div class="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150" (click)="$event.stopPropagation()">
                     <div class="px-3 py-2 bg-gray-950 border-b border-gray-800">
                        <input #newKeyInput type="text" placeholder="Property Name" 
                               (keydown.enter)="addPropertyFromMenu(newKeyInput.value, selectedTypeForAdd())"
                               class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none">
                     </div>
                     <div class="max-h-48 overflow-y-auto p-1">
                        @for (type of availableTypes; track type) {
                           <button (click)="selectedTypeForAdd.set(type)"
                                   [class.bg-blue-900.text-blue-200]="selectedTypeForAdd() === type"
                                   [class.text-gray-400]="selectedTypeForAdd() !== type"
                                   class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-800 transition-colors flex items-center justify-between">
                              <span class="capitalize">{{ type }}</span>
                              @if (selectedTypeForAdd() === type) { <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> }
                           </button>
                        }
                     </div>
                     <button (click)="addPropertyFromMenu(newKeyInput.value, selectedTypeForAdd())" class="w-full text-center py-2 text-xs font-bold text-green-400 border-t border-gray-800 hover:bg-gray-800 transition-colors">
                        Create
                     </button>
                   </div>
                   <div class="fixed inset-0 z-40" (click)="toggleAddMenu($event)"></div>
                 }
               </div>

               <button type="button" (click)="toggleCommentBox($event)" [class.text-yellow-400]="hasComment()" [class.opacity-100]="hasComment()" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400 transition-colors opacity-50">
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               </button>
            </div>
          </div>
          
          <!-- Comment Box -->
          @if (showCommentBox) {
            <div class="mb-2 pl-7 pr-2 animate-fadeIn">
               <textarea 
                  [value]="comments()[path()] || ''" 
                  (input)="updateComment($event)"
                  placeholder="// Add a comment..."
                  class="w-full bg-gray-950 text-gray-400 text-xs p-2 rounded border border-gray-800 focus:border-blue-500/50 outline-none font-mono resize-y min-h-[60px] shadow-inner"
                  (click)="$event.stopPropagation()"></textarea>
            </div>
          }
          
          <!-- Children -->
          @if (expanded()) {
            <div class="flex flex-col gap-0.5 pl-5 relative z-10">
              @for (key of filteredKeys(); track key) {
                <div class="relative group/item">
                  <app-recursive-field 
                    [control]="getControl(key)" 
                    [label]="key"
                    [path]="currentPath(key)"
                    [comments]="comments()"
                    [searchTerm]="nextSearchTerm()"
                    [errorMap]="errorMap()"
                    [activeErrorPath]="activeErrorPath()"
                    (commentChange)="propagateCommentChange($event)">
                  </app-recursive-field>

                  <!-- Safety Delete Button -->
                  <button type="button" 
                          (click)="removePropertySafe(key, $event)"
                          (mouseleave)="cancelDelete(key)"
                          class="absolute right-2 top-2 p-1 transition-all z-20 opacity-0 group-hover/item:opacity-100 rounded"
                          [class.text-red-500.bg-red-900.bg-opacity-20]="deleteConfirmId() === key"
                          [class.text-gray-600.hover:text-red-400]="deleteConfirmId() !== key"
                          [title]="deleteConfirmId() === key ? 'Click again to confirm' : 'Remove Property'">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
      
      <!-- ==================== ARRAY (FormArray) ==================== -->
      @else if (isArray()) {
        <div class="relative">
          @if (expanded()) {
            <div class="absolute left-[11px] top-8 bottom-0 w-px bg-gray-800 group-hover/field:bg-gray-700 transition-colors z-0"></div>
          }

          <div class="flex items-center py-1.5 group/header -ml-2 pl-2 pr-2 rounded hover:bg-gray-800/50 cursor-pointer transition-colors select-none"
               (click)="toggleExpand()">
               
            <div class="mr-2 text-gray-500 transition-transform duration-200 flex items-center justify-center w-4 h-4"
                  [class.rotate-90]="expanded()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            <div class="flex items-baseline gap-2 flex-1 min-w-0">
               <span class="font-mono font-semibold text-gray-300 tracking-tight truncate"
                     [class.text-red-400]="hasChildErrors()"
                     [class.text-purple-300]="!hasChildErrors()">
                   <span [class.bg-yellow-500.text-black.px-0.5.rounded-sm]="labelMatches()">{{ label() }}</span>
               </span>
               <span class="text-[10px] font-bold text-gray-600 uppercase tracking-wider bg-gray-800/50 px-1.5 rounded border border-gray-700/50">
                 Array [{{ getArrayLength() }}]
               </span>
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
               <!-- Sort -->
               <button type="button" (click)="toggleSort($event)" 
                       class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400 transition-colors" 
                       [title]="sortTooltip()">
                  @if (sortDirection() === 'asc') {
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/></svg>
                  } @else if (sortDirection() === 'desc') {
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h4"/><path d="M11 9h7"/><path d="M11 13h10"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4" transform="scale(1, -1) translate(0, -22)"/></svg>
                  } @else {
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>
                  }
               </button>

               <!-- Sort Menu -->
               @if (isObjectArray()) {
                 <div class="relative inline-block">
                     <button type="button" (click)="toggleSortMenu($event)" 
                             [class.text-blue-400]="customSortKey()"
                             class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-300 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                     </button>
                     
                     @if (showSortMenu) {
                         <div class="absolute top-full right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded shadow-xl z-30 overflow-hidden">
                            <div class="px-3 py-1.5 text-[10px] text-gray-500 font-bold border-b border-gray-800 uppercase tracking-wider bg-gray-950">Sort By</div>
                            <div class="max-h-48 overflow-y-auto">
                              @for(key of availableSortKeys(); track key) {
                                  <button type="button" 
                                          (click)="setSortKey(key)"
                                          class="block w-full text-left px-3 py-2 text-xs hover:bg-gray-800 text-gray-300 truncate"
                                          [class.text-blue-400]="customSortKey() === key"
                                          [class.font-bold]="customSortKey() === key">
                                     {{ key }}
                                  </button>
                              }
                            </div>
                            <button type="button" (click)="setSortKey('')" class="block w-full text-left px-3 py-2 text-xs hover:bg-gray-800 text-gray-400 italic border-t border-gray-800 bg-gray-950">
                                Auto {{ detectedSortKey() ? '(' + detectedSortKey() + ')' : '(Default)' }}
                            </button>
                         </div>
                         <div class="fixed inset-0 z-20" (click)="toggleSortMenu($event)"></div>
                     }
                 </div>
               }

               <!-- Add Item -->
               <div class="relative">
                 <button type="button" (click)="toggleAddMenu($event)" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400 transition-colors" title="Add Item">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                 </button>
                 
                 <!-- Array Type Menu -->
                 @if (showAddMenu()) {
                   <div class="absolute right-0 top-full mt-1 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150" (click)="$event.stopPropagation()">
                     <div class="px-3 py-1.5 text-[10px] text-gray-500 font-bold border-b border-gray-800 uppercase bg-gray-950">Add Item</div>
                     <div class="max-h-48 overflow-y-auto p-1">
                        @for (type of availableTypes; track type) {
                           <button (click)="addItemWithType(type)"
                                   class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors">
                              <span class="capitalize">{{ type }}</span>
                           </button>
                        }
                     </div>
                   </div>
                   <div class="fixed inset-0 z-40" (click)="toggleAddMenu($event)"></div>
                 }
               </div>

               <button type="button" (click)="toggleCommentBox($event)" [class.text-yellow-400]="hasComment()" [class.opacity-100]="hasComment()" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400 transition-colors opacity-50">
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               </button>
            </div>
          </div>
          
          @if (showCommentBox) {
            <div class="mb-2 pl-7 pr-2 animate-fadeIn">
               <textarea 
                  [value]="comments()[path()] || ''" 
                  (input)="updateComment($event)"
                  placeholder="// Add a comment..."
                  class="w-full bg-gray-950 text-gray-400 text-xs p-2 rounded border border-gray-800 focus:border-blue-500/50 outline-none font-mono resize-y min-h-[60px] shadow-inner"
                  (click)="$event.stopPropagation()"></textarea>
            </div>
          }

          @if (expanded()) {
            <div class="flex flex-col gap-0.5 pl-5 relative z-10">
              @for (item of filteredArrayControls(); track item.i) {
                <!-- Draggable Container -->
                <div class="relative group/item transition-all duration-200 rounded"
                     [draggable]="canDrag()"
                     (dragstart)="onDragStart($event, item.i)"
                     (dragend)="onDragEnd($event)"
                     (dragover)="onDragOver($event, item.i)"
                     (dragleave)="onDragLeave($event)"
                     (drop)="onDrop($event, item.i)"
                     [class.opacity-40]="draggingIndex() === item.i"
                     [class.border-t-2]="dragOverIndex() === item.i && dragPosition() === 'top'"
                     [class.border-b-2]="dragOverIndex() === item.i && dragPosition() === 'bottom'"
                     [class.border-blue-500]="dragOverIndex() === item.i">
                     
                  <!-- Drag Handle -->
                  @if (canDrag()) {
                    <div class="absolute -left-3 top-3 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 opacity-0 group-hover/item:opacity-100 z-20 flex flex-col items-center justify-center h-4 w-2"
                         title="Drag to reorder">
                       <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><circle cx="1" cy="2" r="1"/><circle cx="1" cy="5" r="1"/><circle cx="1" cy="8" r="1"/><circle cx="5" cy="2" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="5" cy="8" r="1"/></svg>
                    </div>
                  }

                  <span class="absolute -left-6 top-3 text-[10px] text-gray-600 font-mono select-none w-4 text-right">{{ item.i }}</span>
                  <app-recursive-field 
                    [control]="item.c" 
                    [label]="'Item ' + item.i"
                    [path]="currentPath(item.i.toString())"
                    [comments]="comments()"
                    [searchTerm]="nextSearchTerm()"
                    [errorMap]="errorMap()"
                    [activeErrorPath]="activeErrorPath()"
                    (commentChange)="propagateCommentChange($event)">
                  </app-recursive-field>

                  <button type="button" 
                          (click)="removeItemSafe(item.i, $event)"
                          (mouseleave)="cancelDelete(item.i.toString())"
                          class="absolute right-2 top-2 p-1 transition-all z-20 opacity-0 group-hover/item:opacity-100 rounded"
                          [class.text-red-500.bg-red-900.bg-opacity-20]="deleteConfirmId() === item.i.toString()"
                          [class.text-gray-600.hover:text-red-400]="deleteConfirmId() !== item.i.toString()"
                          [title]="deleteConfirmId() === item.i.toString() ? 'Click again to confirm' : 'Remove Item'">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              }
              
              @if (getArrayLength() === 0) {
                 <div class="text-xs text-gray-500 italic py-2 pl-1 flex items-center gap-2">
                    <span>Empty array</span>
                    <button class="text-blue-400 hover:text-blue-300 hover:underline" (click)="toggleAddMenu($event)">Add first item</button>
                 </div>
              }
            </div>
          }
        </div>
      }
      
      <!-- ==================== PRIMITIVE (FormControl) ==================== -->
      @else {
        <div class="group/primitive flex items-start gap-3 py-1.5 hover:bg-gray-800/40 rounded -ml-2 pl-2 pr-2 transition-colors relative">
          <!-- Label -->
          <div class="w-1/3 min-w-[120px] max-w-[220px] flex-shrink-0 pt-2 truncate text-xs font-medium text-gray-400 font-mono select-none relative group/label">
             <span [class.bg-yellow-500.text-black.px-0.5.rounded-sm]="labelMatches()" [title]="label()">{{ label() }}</span>
             
             <!-- Type Switcher Trigger (Only on hover) -->
             <button (click)="toggleTypeMenu($event)" class="absolute right-0 top-1.5 p-0.5 text-[9px] uppercase tracking-wider bg-gray-800 text-gray-500 rounded border border-gray-700 opacity-0 group-hover/label:opacity-100 hover:text-white transition-opacity">
               {{ inputType }}
             </button>

             <!-- Type Menu -->
             @if (showTypeMenu()) {
                <div class="absolute left-0 top-full mt-1 w-24 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 overflow-hidden" (click)="$event.stopPropagation()">
                   @for(t of ['string', 'number', 'boolean']; track t) {
                     <button (click)="switchType(t)" class="block w-full text-left px-2 py-1 text-[10px] uppercase text-gray-400 hover:bg-gray-800 hover:text-white">
                       {{ t }}
                     </button>
                   }
                </div>
                <div class="fixed inset-0 z-40" (click)="toggleTypeMenu($event)"></div>
             }
          </div>
          
          <!-- Input Area -->
          <div class="flex-1 min-w-0 relative">
              @if (inputType === 'boolean') {
                <div class="flex items-center h-8">
                  <button 
                    type="button"
                    (click)="toggleBoolean()"
                    [class.bg-green-600]="control.value"
                    [class.bg-gray-800]="!control.value"
                    [class.ring-1.ring-red-500]="!!errorMessage()"
                    [class.border-gray-600]="!control.value"
                    class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 border">
                    <span 
                      [class.translate-x-4]="control.value"
                      [class.translate-x-0]="!control.value"
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out">
                    </span>
                  </button>
                  <span class="ml-2 text-xs text-gray-500 font-mono cursor-pointer hover:text-gray-300" (click)="toggleBoolean()">{{ control.value ? 'true' : 'false' }}</span>
                </div>
              } 
              @else if (inputType === 'number') {
                <input 
                  [formControl]="asFormControl()" 
                  type="number"
                  [class.bg-yellow-900.border-yellow-500]="valueMatches()"
                  [class.border-red-500.focus:ring-red-500]="!!errorMessage()"
                  [class.border-gray-800.focus:border-blue-500]="!errorMessage()"
                  class="block w-full rounded bg-gray-950 py-1.5 px-3 text-blue-200 shadow-sm border focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm font-mono transition-colors placeholder-gray-700">
              } 
              @else {
                <input 
                  [formControl]="asFormControl()" 
                  type="text"
                  [class.bg-yellow-900.border-yellow-500]="valueMatches()"
                  [class.border-red-500.focus:ring-red-500]="!!errorMessage()"
                  [class.border-gray-800.focus:border-blue-500]="!errorMessage()"
                  class="block w-full rounded bg-gray-950 py-1.5 px-3 text-gray-300 shadow-sm border focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm font-mono transition-colors placeholder-gray-700">
              }
              
              <!-- Error Message Display -->
              @if (errorMessage()) {
                <div class="text-[10px] text-red-400 mt-1 font-mono flex items-center gap-1 animate-fadeIn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  {{ errorMessage() }}
                </div>
              }
              
              <!-- Comment Box -->
              @if (showCommentBox) {
                <div class="mt-2 animate-fadeIn relative z-20">
                   <textarea 
                      [value]="comments()[path()] || ''" 
                      (input)="updateComment($event)"
                      placeholder="// Comment..."
                      class="w-full bg-gray-950 text-gray-400 text-xs p-2 rounded border border-gray-800 focus:border-blue-500/50 outline-none font-mono resize-y min-h-[50px] shadow-lg"></textarea>
                </div>
             }
          </div>
          
          <div class="flex-shrink-0 w-6 flex justify-end opacity-0 group-hover/primitive:opacity-100 transition-opacity pt-1.5">
             <button type="button" (click)="toggleCommentBox($event)" 
                [class.text-yellow-400]="hasComment()" 
                [class.opacity-100]="hasComment()"
                class="text-gray-500 hover:text-yellow-400 p-1 transition-colors opacity-50"
                title="Add Comment">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
             </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .animate-fadeIn {
      animation: fadeIn 0.15s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-2px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class RecursiveFieldComponent {
  @Input({ required: true }) control!: AbstractControl;
  
  label = input<string>('');
  path = input<string>('');
  comments = input<Record<string, string>>({});
  searchTerm = input<string>('');
  errorMap = input<Record<string, string>>({});
  activeErrorPath = input<string | null>(null);
  
  commentChange = output<{ path: string, comment: string }>();

  expanded = signal(true);
  showCommentBox = false;

  controlsVersion = signal(0);
  sortDirection = signal<'asc' | 'desc' | null>(null);
  
  // Custom Sort State
  customSortKey = signal<string | null>(null);
  showSortMenu = false;
  
  // Creation State
  showAddMenu = signal(false);
  availableTypes: FieldType[] = ['string', 'number', 'boolean', 'object', 'array'];
  selectedTypeForAdd = signal<FieldType>('string');
  
  // Type Switcher State (Primitives)
  showTypeMenu = signal(false);

  // Deletion State
  deleteConfirmId = signal<string | null>(null);

  // Drag State
  draggingIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);
  dragPosition = signal<'top' | 'bottom' | null>(null);

  private fb: FormBuilder = inject(FormBuilder);

  constructor() {
    effect(() => {
      // Auto expand if there is a search term and we are filtering
      if (this.searchTerm()) {
        this.expanded.set(true);
      }
      
      // Auto expand if we are on the path to an error
      const errPath = this.activeErrorPath();
      const myPath = this.path();
      
      if (errPath && errPath.startsWith(myPath) && errPath !== myPath) {
        this.expanded.set(true);
      }
    });
  }
  
  isHighlighted = computed(() => {
     return this.activeErrorPath() === this.path();
  });

  get inputType(): 'string' | 'number' | 'boolean' {
    const val = this.control.value;
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    return 'string';
  }

  // Error Logic
  errorMessage = computed(() => {
    const p = this.path();
    const map = this.errorMap();
    return map[p] || '';
  });

  // Check if any descendant has an error (for styling the group border)
  hasChildErrors = computed(() => {
    const myPath = this.path();
    const map = this.errorMap();
    const keys = Object.keys(map);
    return keys.some(k => k.startsWith(myPath + '.') || k === myPath);
  });

  // Matching Logic for UI Highlighting
  labelMatches = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return term && this.label().toLowerCase().includes(term);
  });

  valueMatches = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term || !this.asFormControl()) return false;
    return String(this.control.value).toLowerCase().includes(term);
  });

  nextSearchTerm = computed(() => {
    const term = this.searchTerm();
    if (!term) return '';
    // If I match either Label or Value, I "consume" the filter for my subtree.
    if (this.labelMatches() || this.valueMatches()) {
       return '';
    }
    return term;
  });

  // Filtered Keys for Group
  filteredKeys = computed(() => {
    this.controlsVersion(); // Dependency to update when adding/removing properties
    const term = this.searchTerm().toLowerCase();
    const allKeys = this.getGroupKeys();
    if (!term) return allKeys;
    
    return allKeys.filter(key => this.hasMatch(this.getControl(key), key, term));
  });

  // Filtered Items for Array
  filteredArrayControls = computed(() => {
    const term = this.searchTerm().toLowerCase();
    this.controlsVersion(); // Dependency to trigger re-calc on add/remove/sort
    const allControls = this.getArrayControls();
    
    if (!term) return allControls.map((c, i) => ({c, i}));

    const res: {c: AbstractControl, i: number}[] = [];
    allControls.forEach((c, i) => {
      if (this.hasMatch(c, i, term)) {
        res.push({c, i});
      }
    });
    return res;
  });
  
  // Detect a good candidate key for sorting automatically
  detectedSortKey = computed(() => {
    this.controlsVersion();
    if (!this.isArray()) return null;
    const array = this.control as FormArray;
    if (array.length === 0) return null;
    
    const firstVal = array.at(0).value;
    
    if (typeof firstVal === 'object' && firstVal !== null) {
      const keys = Object.keys(firstVal);
      const candidates = ['name', 'id', 'title', 'key', 'label', 'type', 'slug'];
      return candidates.find(c => keys.includes(c)) || keys[0]; // fallback to first key
    }
    return null;
  });
  
  // Available keys for sorting objects
  availableSortKeys = computed(() => {
    this.controlsVersion(); // Ensure reactivity when array changes
    if (!this.isArray()) return [];
    
    const array = this.control as FormArray;
    if (array.length === 0) return [];
    
    // Inspect first item
    const first = array.at(0);
    if (first instanceof FormGroup) {
        // Only return keys that are simple primitives
        return Object.keys(first.controls).filter(key => {
            const ctrl = first.get(key);
            // We can approximate by checking current value type or if it is a FormControl
            if (ctrl instanceof FormControl) {
                const t = typeof ctrl.value;
                return t === 'string' || t === 'number' || t === 'boolean';
            }
            return false;
        }).sort();
    }
    return [];
  });
  
  isObjectArray = computed(() => {
      return this.availableSortKeys().length > 0;
  });
  
  // --- Creation Logic ---

  toggleAddMenu(event: Event) {
    event.stopPropagation();
    this.showAddMenu.update(v => !v);
    this.selectedTypeForAdd.set('string');
  }

  addPropertyFromMenu(key: string, type: FieldType) {
    if (!this.isGroup()) return;
    
    if (!key || key.trim() === '') {
      alert("Property name is required");
      return;
    }

    const group = this.control as FormGroup;
    if (group.contains(key)) {
      alert(`Property "${key}" already exists.`);
      return;
    }

    const newControl = this.createControlByType(type);
    group.addControl(key, newControl);

    this.showAddMenu.set(false);
    this.controlsVersion.update(v => v + 1);
    this.expanded.set(true);
  }

  addItemWithType(type: FieldType) {
    if (!this.isArray()) return;
    
    const array = this.control as FormArray;
    const newControl = this.createControlByType(type);
    
    array.push(newControl);
    this.showAddMenu.set(false);
    this.controlsVersion.update(v => v + 1);
    this.expanded.set(true);
  }

  createControlByType(type: FieldType): AbstractControl {
    switch (type) {
      case 'string': return this.fb.control('');
      case 'number': return this.fb.control(0);
      case 'boolean': return this.fb.control(false);
      case 'object': return this.fb.group({});
      case 'array': return this.fb.array([]);
      default: return this.fb.control('');
    }
  }

  // --- Deletion Logic ---

  removePropertySafe(key: string, event: Event) {
    event.stopPropagation();
    
    if (this.deleteConfirmId() === key) {
       // Confirmed
       const group = this.control as FormGroup;
       group.removeControl(key);
       this.controlsVersion.update(v => v + 1);
       this.deleteConfirmId.set(null);
    } else {
       // First click
       this.deleteConfirmId.set(key);
    }
  }

  removeItemSafe(index: number, event: Event) {
    event.stopPropagation();
    const id = index.toString();
    
    if (this.deleteConfirmId() === id) {
       (this.control as FormArray).removeAt(index);
       this.controlsVersion.update(v => v + 1);
       this.deleteConfirmId.set(null);
    } else {
       this.deleteConfirmId.set(id);
    }
  }

  cancelDelete(id: string) {
    if (this.deleteConfirmId() === id) {
       this.deleteConfirmId.set(null);
    }
  }
  
  // --- Type Switching Logic (Primitive Only) ---
  toggleTypeMenu(e: Event) {
    e.stopPropagation();
    this.showTypeMenu.update(v => !v);
  }

  switchType(target: string) {
    if (this.control instanceof FormControl) {
       const current = this.control.value;
       let newVal: any = current;
       
       if (target === 'number') newVal = Number(current) || 0;
       if (target === 'string') newVal = String(current);
       if (target === 'boolean') newVal = Boolean(current);
       
       // Force update logic isn't perfect in ReactiveForms without replacing control, 
       // but setValue usually adapts for simple types if logic uses typeof.
       // However, we need the *template* to update its input type. 
       // The `inputType` getter relies on `this.control.value`.
       
       this.control.setValue(newVal);
       this.showTypeMenu.set(false);
    }
  }

  // --- Sorting ---
  toggleSort(event: Event) {
    event.stopPropagation();
    if (!this.isArray()) return;

    const current = this.sortDirection();
    const next = current === 'asc' ? 'desc' : 'asc'; // toggle
    this.sortDirection.set(next);
    
    this.performSort(next);
  }
  
  toggleSortMenu(event: Event) {
    event.stopPropagation();
    this.showSortMenu = !this.showSortMenu;
  }
  
  setSortKey(key: string) {
    this.customSortKey.set(key || null); // Empty string resets to null
    this.showSortMenu = false;
    
    if (this.sortDirection()) {
        this.performSort(this.sortDirection()!);
    }
  }

  performSort(direction: 'asc' | 'desc') {
    const array = this.control as FormArray;
    const controls = [...array.controls]; // shallow copy
    
    if (controls.length === 0) return;

    let sortKey = this.customSortKey() || this.detectedSortKey();

    controls.sort((a, b) => {
       let valA = a.value;
       let valB = b.value;
       
       if (sortKey && typeof valA === 'object' && typeof valB === 'object') {
         valA = valA[sortKey];
         valB = valB[sortKey];
       }
       
       if (valA === null || valA === undefined) valA = '';
       if (valB === null || valB === undefined) valB = '';
       
       if (typeof valA === 'string' || typeof valB === 'string') {
          return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
       }
       
       if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA;
       }
       
       if (valA < valB) return direction === 'asc' ? -1 : 1;
       if (valA > valB) return direction === 'asc' ? 1 : -1;
       return 0;
    });

    array.clear(); 
    controls.forEach(c => array.push(c));
    this.controlsVersion.update(v => v + 1);
  }
  
  sortTooltip = computed(() => {
    const dir = this.sortDirection();
    const key = this.customSortKey() || this.detectedSortKey();
    const next = dir === 'asc' ? 'Descending' : 'Ascending';
    const suffix = key ? ` by '${key}'` : '';
    return `Sort ${next}${suffix}`;
  });

  // --- Utils ---

  private hasMatch(control: AbstractControl, keyOrIndex: string | number, term: string): boolean {
    if (!term) return true;
    if (String(keyOrIndex).toLowerCase().includes(term)) return true;
    if (control instanceof FormControl) {
        return String(control.value).toLowerCase().includes(term);
    }
    if (control instanceof FormGroup) {
        return Object.keys(control.controls).some(k => this.hasMatch(control.get(k)!, k, term));
    }
    if (control instanceof FormArray) {
        return control.controls.some((c, i) => this.hasMatch(c, i, term));
    }
    return false;
  }

  toggleExpand() {
    this.expanded.update(v => !v);
  }

  toggleBoolean() {
    this.control.setValue(!this.control.value);
  }
  
  toggleCommentBox(e: Event) {
    e.stopPropagation();
    this.showCommentBox = !this.showCommentBox;
  }
  
  hasComment() {
    return !!this.comments()[this.path()];
  }
  
  updateComment(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    this.commentChange.emit({ path: this.path(), comment: val });
  }
  
  propagateCommentChange(e: { path: string, comment: string }) {
    this.commentChange.emit(e);
  }

  isGroup(): boolean { return this.control instanceof FormGroup; }
  isArray(): boolean { return this.control instanceof FormArray; }
  getArrayLength(): number { return (this.control as FormArray).length; }
  asFormControl(): FormControl { return this.control as FormControl; }
  getGroupKeys(): string[] { return Object.keys((this.control as FormGroup).controls); }
  getControl(key: string): AbstractControl { return (this.control as FormGroup).get(key)!; }
  getArrayControls(): AbstractControl[] { return (this.control as FormArray).controls; }
  currentPath(key: string): string { return this.path() ? `${this.path()}.${key}` : key; }
  
  // --- Drag and Drop Logic ---
  
  canDrag() {
    // Disable drag if any sorting or searching is active to avoid index mismatch
    return !this.searchTerm() && !this.sortDirection() && !this.customSortKey();
  }

  onDragStart(event: DragEvent, index: number) {
    if (!this.canDrag()) {
      event.preventDefault();
      return;
    }
    this.draggingIndex.set(index);
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', String(index));
    
    // Create a nicer drag image if possible, otherwise browser default
  }

  onDragEnd(event: DragEvent) {
    this.draggingIndex.set(null);
    this.dragOverIndex.set(null);
    this.dragPosition.set(null);
  }

  onDragOver(event: DragEvent, index: number) {
    if (!this.canDrag() || this.draggingIndex() === null || this.draggingIndex() === index) return;
    event.preventDefault(); // allow drop
    event.dataTransfer!.dropEffect = 'move';
    
    // Calculate visual indicator position
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    this.dragOverIndex.set(index);
    this.dragPosition.set(event.clientY < midY ? 'top' : 'bottom');
  }
  
  onDragLeave(event: DragEvent) {
    // Prevent flickering when entering children
    // This simple logic might clear it too often, but improved by onDragOver running continuously
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    
    const startIndex = this.draggingIndex();
    if (startIndex === null || startIndex === dropIndex) return;
    
    // Adjust drop index based on top/bottom
    let finalIndex = dropIndex;
    if (this.dragPosition() === 'bottom') {
       // Dropping below the target means insert after
       // However, if we move down, the target index shifts. 
       // Standard swap logic:
    }
    
    // If we just use swap logic, we don't need complicated index math
    // But for "Insert Between", we need moveItem
    
    this.moveItem(startIndex, dropIndex);
    
    this.draggingIndex.set(null);
    this.dragOverIndex.set(null);
    this.dragPosition.set(null);
  }

  moveItem(fromIndex: number, toIndex: number) {
    if (!this.isArray()) return;
    const array = this.control as FormArray;
    
    const controlToMove = array.at(fromIndex);
    
    // If moving down, index shifts by 1 because of removal
    // Simple approach: Remove then Insert
    array.removeAt(fromIndex);
    
    // Correct index if we removed from before the target
    if (fromIndex < toIndex) {
       // e.g. move 0 to 2. Remove 0. Old 2 becomes 1. We want to insert after it.
       // It's tricky. Let's just swap for simplicity in this specific UI pattern 
       // OR use the visual indicator to determine insert index.
       
       // Visual logic:
       // if dragPosition is top, insert AT toIndex
       // if dragPosition is bottom, insert AT toIndex (but effectively after)
    }

    // Since we removed 'from', if 'to' was greater, it shifted down.
    let insertAt = toIndex;
    if (fromIndex < toIndex) {
        insertAt--; 
    }
    
    if (this.dragPosition() === 'bottom') {
        insertAt++;
    }
    
    // Bound check
    insertAt = Math.max(0, Math.min(insertAt, array.length));
    
    array.insert(insertAt, controlToMove);
    
    // Force FormArray update
    array.updateValueAndValidity();
    this.controlsVersion.update(v => v + 1);
  }
}
