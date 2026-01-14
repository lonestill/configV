import { Component, signal, computed, inject, OnDestroy, OnInit, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, FormArray, AbstractControl } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConfigService, ConfigType, ValidationError } from './services/config.service';
import { FileSystemService, FileSystemEntry, MockFileHandle } from './services/file-system.service';
import { RecursiveFieldComponent } from './components/recursive-field/recursive-field.component';
import { ToolsComponent } from './components/tools/tools.component';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Document } from 'yaml';

declare const Prism: any;

interface FileSession {
  id: string;
  name: string;
  type: ConfigType;
  formGroup: FormGroup;
  history: any[];
  historyIndex: number;
  previewContent: string;
  yamlDoc?: Document;
  comments: Record<string, string>; // path -> comment
  schema?: any;
  validationErrors: ValidationError[];
  subscription?: Subscription;
}

interface PersistedSessionData {
  id: string;
  name: string;
  type: ConfigType;
  data: any;
  comments: Record<string, string>;
  lastModified: number;
}

type AppView = 'editor' | 'tools';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecursiveFieldComponent, ToolsComponent],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent implements OnInit, OnDestroy {
  private fb: FormBuilder = inject(FormBuilder);
  private configService: ConfigService = inject(ConfigService);
  private fileSystem: FileSystemService = inject(FileSystemService);
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;

  // View State
  currentView = signal<AppView>('editor');

  sessions = signal<FileSession[]>([]);
  activeSessionId = signal<string | null>(null);
  
  // File System State
  folderFiles = signal<FileSystemEntry[]>([]);
  isSidebarOpen = signal(false);

  errorMsg = signal<string | null>(null);
  searchTerm = signal<string>('');
  
  // UX State
  showErrorList = signal(false);
  showActionsMenu = signal(false);
  activeErrorPath = signal<string | null>(null);
  showPreview = signal(true);
  
  // Modal State
  isCodeModalOpen = signal(false);
  generatedCode = signal('');
  generatedCodeLang = signal<'typescript' | 'go'>('typescript');

  activeSession = computed(() => this.sessions().find(s => s.id === this.activeSessionId()) || null);
  
  canUndo = computed(() => {
    const s = this.activeSession();
    return s ? s.historyIndex > 0 : false;
  });
  
  canRedo = computed(() => {
    const s = this.activeSession();
    return s ? s.historyIndex < s.history.length - 1 : false;
  });

  highlightedPreview = computed(() => {
    const session = this.activeSession();
    if (!session) return this.sanitizer.bypassSecurityTrustHtml('');

    const lang = session.type;
    const content = session.previewContent;
    
    // Map internal types to prism languages
    let prismLang: string = lang;
    if (lang === 'xml') prismLang = 'markup';
    if (lang === 'env') prismLang = 'bash'; // Close enough for key=value highlighting

    if (typeof Prism !== 'undefined' && Prism.languages[prismLang]) {
        const highlighted = Prism.highlight(content, Prism.languages[prismLang], prismLang);
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }

    return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(content));
  });

  highlightedGeneratedCode = computed(() => {
    const code = this.generatedCode();
    const lang = this.generatedCodeLang();
     if (typeof Prism !== 'undefined' && Prism.languages[lang]) {
        const highlighted = Prism.highlight(code, Prism.languages[lang], lang);
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }
    return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(code));
  });

  filteredRootKeys = computed(() => {
    const session = this.activeSession();
    if (!session) return [];
    
    const term = this.searchTerm().trim().toLowerCase();
    const keys = Object.keys(session.formGroup.controls);
    
    if (!term) return keys;

    return keys.filter(key => {
      // Use direct property access to handle keys with dots
      const control = session.formGroup.controls[key];
      return control ? this.hasMatch(control, key, term) : false;
    });
  });

  // Maps "path.to.key" -> "Error Message"
  errorMap = computed(() => {
    const session = this.activeSession();
    if (!session || session.validationErrors.length === 0) return {};
    
    const map: Record<string, string> = {};
    session.validationErrors.forEach(err => {
      map[err.path] = err.message;
    });
    return map;
  });

  constructor() {
    effect(() => {
      const currentSessions = this.sessions();
      this.persistSessions(currentSessions);
    });
  }

  ngOnInit() {
    this.loadPersistedSessions();
  }

  ngOnDestroy() {
    this.sessions().forEach(s => s.subscription?.unsubscribe());
  }

  setView(view: AppView) {
    this.currentView.set(view);
  }

  // --- Actions ---
  toggleActionsMenu(e?: Event) {
    if (e) e.stopPropagation();
    this.showActionsMenu.update(v => !v);
  }

  convertConfig() {
    const session = this.activeSession();
    if (!session) return;
    
    // Cycle through types: json -> yaml -> ini -> xml -> env -> json
    const order: ConfigType[] = ['json', 'yaml', 'ini', 'xml', 'env'];
    const currentIdx = order.indexOf(session.type);
    const newType = order[(currentIdx + 1) % order.length];
    
    this.sessions.update(current => current.map(s => {
      if (s.id !== session.id) return s;
      
      const data = s.formGroup.getRawValue();
      let doc: Document | undefined;
      let preview = '';
      
      // Special Handling
      if (newType === 'yaml') {
         const yamlStr = this.configService.stringify(data, 'yaml');
         const res = this.configService.parse(yamlStr, 'yaml');
         doc = res.doc;
         preview = yamlStr;
      } else {
         preview = this.configService.stringify(data, newType);
      }

      // Rename file extension
      const oldName = s.name;
      const baseName = oldName.substring(0, oldName.lastIndexOf('.')) || oldName;
      let ext: string = newType;
      if (newType === 'xml' && oldName.endsWith('.config')) ext = 'config';
      
      const newName = `${baseName}.${ext}`;

      return {
        ...s,
        name: newName,
        type: newType,
        yamlDoc: doc,
        previewContent: preview
      };
    }));
    
    this.showActionsMenu.set(false);
  }

  openTypeModal(lang: 'typescript' | 'go') {
    const session = this.activeSession();
    if (!session) return;
    
    const data = session.formGroup.getRawValue();
    let code = '';
    
    if (lang === 'typescript') {
      code = this.configService.generateTypeScript(data);
    } else {
      code = this.configService.generateGoStruct(data);
    }
    
    this.generatedCode.set(code);
    this.generatedCodeLang.set(lang);
    this.isCodeModalOpen.set(true);
    this.showActionsMenu.set(false);
  }

  closeCodeModal() {
    this.isCodeModalOpen.set(false);
  }

  copyGeneratedCode() {
    navigator.clipboard.writeText(this.generatedCode());
  }

  // --- Persistence ---

  private persistSessions(sessions: FileSession[]) {
    const dataToSave: PersistedSessionData[] = sessions.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      data: s.formGroup.getRawValue(),
      comments: s.comments,
      lastModified: Date.now()
    }));
    
    try {
      localStorage.setItem('configv_sessions', JSON.stringify(dataToSave));
      localStorage.setItem('configv_active_id', this.activeSessionId() || '');
    } catch (e) {
      console.warn('Failed to save session', e);
    }
  }

  private loadPersistedSessions() {
    try {
      const raw = localStorage.getItem('configv_sessions');
      const activeId = localStorage.getItem('configv_active_id');
      
      if (!raw) return;

      const savedData: PersistedSessionData[] = JSON.parse(raw);
      if (!Array.isArray(savedData)) return;

      savedData.forEach(s => {
        let doc: Document | undefined;
        let preview = '';
        
        if (s.type === 'yaml') {
           const yamlStr = this.configService.stringify(s.data, 'yaml');
           const result = this.configService.parse(yamlStr, 'yaml');
           doc = result.doc;
           preview = yamlStr;
        } else {
           preview = this.configService.stringify(s.data, s.type);
        }

        this.createSession(s.name, s.type, s.data, doc, s.comments, undefined, s.id);
      });

      if (activeId && savedData.some(s => s.id === activeId)) {
        this.activeSessionId.set(activeId);
      } else if (savedData.length > 0) {
        this.activeSessionId.set(savedData[0].id);
      }

    } catch (e) {
      console.error('Failed to restore sessions', e);
      localStorage.removeItem('configv_sessions');
    }
  }

  // --- File System ---

  async openLocalFolder() {
    if (this.currentView() !== 'editor') {
      this.currentView.set('editor');
    }

    try {
      const files = await this.fileSystem.openFolder();
      if (files.length > 0) {
        this.folderFiles.set(files);
        this.isSidebarOpen.set(true);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === 'SecurityError' || err.message.includes('Cross origin') || err.message === 'FileSystemAccessUnsupported') {
        this.folderInput.nativeElement.click();
      } else {
        console.error('Error opening folder:', e);
      }
    }
  }

  handleFolderSelect(event: Event) {
    if (this.currentView() !== 'editor') {
      this.currentView.set('editor');
    }
    
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const entries: FileSystemEntry[] = [];
      Array.from(input.files).forEach(file => {
         if (this.fileSystem.isConfigFile(file.name)) {
           const mockHandle: MockFileHandle = {
             kind: 'file',
             name: file.name,
             getFile: async () => file
           };
           entries.push({ name: file.name, handle: mockHandle, kind: 'file' });
         }
      });
      if (entries.length > 0) {
        entries.sort((a, b) => a.name.localeCompare(b.name));
        this.folderFiles.set(entries);
        this.isSidebarOpen.set(true);
      }
    }
    input.value = ''; 
  }

  async openFileFromSidebar(entry: FileSystemEntry) {
    try {
      const file = await this.fileSystem.readFile(entry.handle);
      this.processFile(file);
    } catch (e) {
      console.error('Error reading file', e);
      alert('Could not read file. Check permissions.');
    }
  }
  
  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  // --- Editor Logic ---
  
  togglePreview() {
    this.showPreview.update(v => !v);
  }

  toggleErrorList(event?: Event) {
    if (event) event.stopPropagation();
    this.showErrorList.update(v => !v);
  }

  scrollToError(path: string) {
    this.activeErrorPath.set(path);
    this.showErrorList.set(false);

    setTimeout(() => {
       const el = document.getElementById('field-' + path);
       if (el) {
         el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
    }, 150);
    
    setTimeout(() => {
       this.activeErrorPath.set(null);
    }, 2500);
  }

  escapeHtml(unsafe: string) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
  
  hasMatch(control: AbstractControl, keyOrIndex: string | number, term: string): boolean {
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

  handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      if (this.currentView() !== 'editor') this.currentView.set('editor');
      Array.from(files).forEach(file => this.processFile(file));
    }
  }

  handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      if (this.currentView() !== 'editor') this.currentView.set('editor');
      Array.from(input.files).forEach(file => this.processFile(file));
    }
    input.value = ''; 
  }
  
  handleSchemaSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target?.result as string);
          
          this.sessions.update(sessions => sessions.map(s => {
             if (s.id === this.activeSessionId()) {
               const errors = this.configService.validate(s.formGroup.getRawValue(), schema);
               return { ...s, schema, validationErrors: errors };
             }
             return s;
          }));
          
        } catch (err) {
          alert('Invalid JSON Schema file.');
        }
      };
      reader.readAsText(file);
    }
    input.value = '';
  }

  updateSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.searchTerm.set(val);
  }

  processFile(file: File) {
    this.errorMsg.set(null);
    const existing = this.sessions().find(s => s.name === file.name);
    if (existing) {
      if (confirm(`File "${file.name}" is already open. Overwrite it?`)) {
        this.closeSession(null, existing.id);
      } else {
        this.setActive(existing.id);
        return;
      }
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const type = this.configService.detectType(file.name);

      try {
        const result = this.configService.parse(content, type);
        this.createSession(file.name, type, result.data, result.doc, result.comments);
      } catch (err) {
        this.errorMsg.set(`Failed to parse ${file.name}. Check syntax.`);
      }
    };
    reader.readAsText(file);
  }

  loadDemo(type: ConfigType) {
    let name = `demo.${type}`;
    let content = '';

    if (type === 'json') {
      content = JSON.stringify({
        "server": { "port": 9090, "host": "localhost" },
        "features": ["auth", "logging"]
      }, null, 2);
    } 
    else if (type === 'yaml') {
      content = `app:\n  name: MyApp\n  version: 1.0.0\nserver:\n  port: 8080`;
    }
    else if (type === 'ini') {
      content = `[server]\nport=8080\nhost=0.0.0.0\n\n[database]\ntype=mysql\nhost=localhost`;
    }
    else if (type === 'env') {
      content = `PORT=3000\nNODE_ENV=production\nDB_PASS=secret123`;
      name = '.env.example';
    }
    else if (type === 'xml') {
      content = `<configuration>\n  <appSettings>\n    <add key="ClientValidationEnabled" value="true" />\n    <add key="UnobtrusiveJavaScriptEnabled" value="true" />\n  </appSettings>\n  <system.web>\n    <compilation debug="true" targetFramework="4.8" />\n  </system.web>\n</configuration>`;
      name = 'web.config';
    }

    const existing = this.sessions().find(s => s.name === name);
    if (existing) {
      this.setActive(existing.id);
      return;
    }

    try {
      const result = this.configService.parse(content, type);
      this.createSession(name, type, result.data, result.doc, result.comments);
    } catch (err) {
      console.error(err);
    }
  }

  createSession(name: string, type: ConfigType, data: any, doc?: Document, comments: Record<string, string> = {}, schema?: any, existingId?: string) {
    const formGroup = this.buildFormGroup(data);
    const initialHistory = [JSON.parse(JSON.stringify(data))];
    const initialPreview = this.configService.stringify(data, type, doc);
    
    let initialErrors: ValidationError[] = [];
    if (schema) {
      initialErrors = this.configService.validate(data, schema);
    }
    
    const id = existingId || crypto.randomUUID();
    
    const session: FileSession = {
      id,
      name,
      type,
      formGroup,
      history: initialHistory,
      historyIndex: 0,
      previewContent: initialPreview,
      yamlDoc: doc,
      comments: comments,
      schema: schema,
      validationErrors: initialErrors
    };

    session.subscription = formGroup.valueChanges.pipe(
      debounceTime(300)
    ).subscribe(val => {
      this.handleValueChange(id, val);
    });

    this.sessions.update(s => [...s, session]);
    this.activeSessionId.set(id);
    this.searchTerm.set(''); 
    this.showErrorList.set(false);
  }

  handleValueChange(sessionId: string, val: any) {
    this.sessions.update(currentSessions => {
      return currentSessions.map(session => {
        if (session.id !== sessionId) return session;

        let preview = '';
        if (session.type === 'yaml' && session.yamlDoc) {
          this.configService.updateYamlDoc(session.yamlDoc, val);
          preview = session.yamlDoc.toString();
        } else {
          preview = this.configService.stringify(val, session.type);
        }

        let errors = session.validationErrors;
        if (session.schema) {
          errors = this.configService.validate(val, session.schema);
        }

        const newState = JSON.parse(JSON.stringify(val));
        let newHistory = session.history;
        let newIndex = session.historyIndex;

        if (newIndex < newHistory.length - 1) {
           newHistory = newHistory.slice(0, newIndex + 1);
        }
        
        newHistory = [...newHistory, newState];
        newIndex = newHistory.length - 1;

        return {
          ...session,
          history: newHistory,
          historyIndex: newIndex,
          previewContent: preview,
          validationErrors: errors
        };
      });
    });
  }
  
  handleCommentChange(path: string, comment: string) {
    const session = this.activeSession();
    if (!session || session.type !== 'yaml' || !session.yamlDoc) return;
    
    const pathArr = path.split('.');
    this.configService.setComment(session.yamlDoc, pathArr, comment);
    
    this.sessions.update(s => s.map(sess => {
      if (sess.id !== session.id) return sess;
      return {
        ...sess,
        comments: { ...sess.comments, [path]: comment },
        previewContent: session.yamlDoc!.toString()
      };
    }));
  }

  closeSession(event: Event | null, id: string) {
    if (event) event.stopPropagation();
    const session = this.sessions().find(s => s.id === id);
    if (session) {
      session.subscription?.unsubscribe();
    }
    
    this.sessions.update(s => s.filter(x => x.id !== id));
    
    const remaining = this.sessions();
    if (this.activeSessionId() === id) {
      this.activeSessionId.set(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }

  setActive(id: string) {
    this.activeSessionId.set(id);
    this.searchTerm.set(''); 
    this.showErrorList.set(false);
    this.currentView.set('editor');
  }

  undo() {
    const session = this.activeSession();
    if (!session || !this.canUndo()) return;

    const newIndex = session.historyIndex - 1;
    this.restoreState(session, newIndex);
  }

  redo() {
    const session = this.activeSession();
    if (!session || !this.canRedo()) return;

    const newIndex = session.historyIndex + 1;
    this.restoreState(session, newIndex);
  }

  restoreState(session: FileSession, index: number) {
    const state = session.history[index];
    session.formGroup.setValue(state, { emitEvent: false });
    
    let errors = session.validationErrors;
    if (session.schema) {
       errors = this.configService.validate(state, session.schema);
    }
    
    let preview = '';
    if (session.type === 'yaml' && session.yamlDoc) {
      this.configService.updateYamlDoc(session.yamlDoc, state);
      preview = session.yamlDoc.toString();
    } else {
      preview = this.configService.stringify(state, session.type);
    }

    this.sessions.update(current => current.map(s => {
      if (s.id !== session.id) return s;
      return {
        ...s,
        historyIndex: index,
        previewContent: preview,
        validationErrors: errors
      };
    }));
  }

  buildFormGroup(data: any): FormGroup {
    const rootGroup = this.fb.group({});
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.keys(data).forEach(key => {
            rootGroup.addControl(key, this.createControl(data[key]));
        });
    }
    return rootGroup;
  }

  createControl(data: any): AbstractControl {
    if (Array.isArray(data)) {
      const formArray = this.fb.array([]);
      data.forEach(item => {
        formArray.push(this.createControl(item));
      });
      return formArray;
    } else if (data !== null && typeof data === 'object') {
      const group = this.fb.group({});
      Object.keys(data).forEach(key => {
        group.addControl(key, this.createControl(data[key]));
      });
      return group;
    } else {
      return new FormControl(data);
    }
  }

  downloadConfig() {
    const session = this.activeSession();
    if (!session) return;
    
    const blob = new Blob([session.previewContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = session.name;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  copyToClipboard() {
    const session = this.activeSession();
    if (session) {
      navigator.clipboard.writeText(session.previewContent);
    }
  }
  
  getControl(group: FormGroup, key: string): AbstractControl {
    return group.controls[key];
  }
}
