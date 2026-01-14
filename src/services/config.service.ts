import { Injectable } from '@angular/core';
import { parseDocument, Document, isMap, isSeq } from 'yaml';
import Ajv from 'ajv';
import * as ini from 'ini';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export type ConfigType = 'json' | 'yaml' | 'ini' | 'env' | 'xml';

export interface ParsedResult {
  data: any;
  doc?: Document;
  comments?: Record<string, string>;
}

export interface ValidationError {
  path: string; // dot notation
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private ajv = new Ajv({ allErrors: true, verbose: true });
  private xmlParser = new XMLParser({ 
    ignoreAttributes: false,
    attributeNamePrefix: "@_" 
  });
  private xmlBuilder = new XMLBuilder({ 
    ignoreAttributes: false, 
    format: true,
    attributeNamePrefix: "@_" 
  });

  parse(content: string, type: ConfigType): ParsedResult {
    try {
      if (type === 'json') {
        return { data: JSON.parse(content) };
      } else if (type === 'yaml') {
        const doc = parseDocument(content);
        const data = doc.toJS();
        const comments = this.extractComments(doc);
        return { data, doc, comments };
      } else if (type === 'ini') {
        const data = ini.parse(content);
        return { data };
      } else if (type === 'env') {
        const data = this.parseEnv(content);
        return { data };
      } else if (type === 'xml') {
        const data = this.xmlParser.parse(content);
        return { data };
      }
      return { data: {} };
    } catch (e) {
      console.error('Parsing error', e);
      throw new Error(`Failed to parse ${type.toUpperCase()} file.`);
    }
  }

  stringify(data: any, type: ConfigType, doc?: Document): string {
    try {
      if (type === 'json') {
        return JSON.stringify(data, null, 2);
      } else if (type === 'yaml') {
        if (doc) {
          return doc.toString(); 
        }
        return new Document(data).toString();
      } else if (type === 'ini') {
        return ini.stringify(data);
      } else if (type === 'env') {
        return this.stringifyEnv(data);
      } else if (type === 'xml') {
        return this.xmlBuilder.build(data);
      }
      return '';
    } catch (e) {
      console.error('Stringify error', e);
      return '';
    }
  }

  detectType(filename: string): ConfigType {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
    if (lower.endsWith('.ini')) return 'ini';
    if (lower.endsWith('.xml') || lower.endsWith('.config')) return 'xml';
    if (lower.endsWith('.env') || lower.startsWith('.env')) return 'env';
    return 'json';
  }

  validate(data: any, schema: any): ValidationError[] {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(data);
      if (valid) return [];

      return (validate.errors || []).map(err => {
        let path = err.instancePath.replace(/^\//, '').replace(/\//g, '.');
        if (path === '') path = 'root';

        return {
          path,
          message: err.message || 'Invalid value'
        };
      });
    } catch (e) {
      console.error('Schema Validation Error', e);
      return [{ path: 'root', message: 'Schema compilation failed' }];
    }
  }

  // --- ENV Helpers ---

  private parseEnv(content: string): any {
    const res: any = {};
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
       const trimmed = line.trim();
       if (!trimmed || trimmed.startsWith('#')) return;
       
       const eqIdx = trimmed.indexOf('=');
       if (eqIdx > -1) {
         const key = trimmed.substring(0, eqIdx).trim();
         let val = trimmed.substring(eqIdx + 1).trim();
         
         // Remove surrounding quotes if present
         if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
           val = val.substring(1, val.length - 1);
         }
         
         res[key] = val;
       }
    });
    return res;
  }

  private stringifyEnv(data: any): string {
    let res = '';
    // Flatten if nested - though ENV usually isn't. 
    // We'll simplisticly stringify objects if present.
    Object.keys(data).forEach(key => {
       let val = data[key];
       if (typeof val === 'object' && val !== null) {
         val = JSON.stringify(val);
       }
       // Basic escaping/quoting logic could go here
       if (String(val).includes(' ')) {
         val = `"${val}"`;
       }
       res += `${key}=${val}\n`;
    });
    return res;
  }

  // --- YAML Helpers ---

  extractComments(doc: Document): Record<string, string> {
    const comments: Record<string, string> = {};
    const visit = (node: any, path: string[]) => {
      if (!node) return;
      const comment = node.commentBefore || node.comment;
      if (comment) comments[path.join('.')] = comment;
      if (isMap(node)) {
        node.items.forEach((item: any) => {
          const key = item.key.value;
          const currentPath = [...path, key];
          if (item.commentBefore) comments[currentPath.join('.')] = item.commentBefore;
          visit(item.value, currentPath);
        });
      } else if (isSeq(node)) {
        node.items.forEach((item: any, index: number) => {
           visit(item, [...path, index.toString()]);
        });
      }
    };
    visit(doc.contents, []);
    return comments;
  }
  
  updateYamlDoc(doc: Document, newValue: any) {
    const sync = (path: any[], val: any) => {
      if (val === null || typeof val !== 'object') {
        doc.setIn(path, val);
        return;
      }
      const existing = doc.getIn(path);
      if (!existing || (Array.isArray(val) && !isSeq(existing)) || (!Array.isArray(val) && !isMap(existing))) {
        doc.setIn(path, val);
        return;
      }
      if (Array.isArray(val)) {
        const len = val.length;
        val.forEach((item, idx) => sync([...path, idx], item));
        const seqItems = (existing as any).items;
        if (seqItems.length > len) {
           for (let i = seqItems.length - 1; i >= len; i--) doc.deleteIn([...path, i]);
        }
      } else {
        const keys = Object.keys(val);
        keys.forEach(k => sync([...path, k], val[k]));
        const existingKeys = (existing as any).items.map((p: any) => p.key.value);
        existingKeys.forEach((k: string) => {
           if (!(k in val)) doc.deleteIn([...path, k]);
        });
      }
    };
    sync([], newValue);
  }
  
  setComment(doc: Document, path: string[], comment: string) {
    const node = doc.getIn(path, true) as any;
    if (node) node.commentBefore = comment;
  }

  // --- Type Generation ---

  generateTypeScript(data: any, rootName = 'Config'): string {
    let buffer = '';
    const interfaces: Map<string, string> = new Map();

    const getTypeName = (val: any, key: string): string => {
      if (val === null) return 'null';
      const type = typeof val;
      if (type !== 'object') return type;
      if (Array.isArray(val)) {
        if (val.length === 0) return 'any[]';
        const itemType = getTypeName(val[0], key + 'Item');
        return `${itemType}[]`;
      }
      const interfaceName = this.capitalize(key);
      if (!interfaces.has(interfaceName)) {
        interfaces.set(interfaceName, ''); 
        let def = `export interface ${interfaceName} {\n`;
        Object.keys(val).forEach(k => {
           // Handle potential invalid identifiers
           const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
           def += `  ${propName}: ${getTypeName(val[k], k)};\n`;
        });
        def += `}`;
        interfaces.set(interfaceName, def);
      }
      return interfaceName;
    };
    getTypeName(data, rootName);
    Array.from(interfaces.values()).forEach(def => buffer += def + '\n\n');
    return buffer.trim();
  }

  generateGoStruct(data: any, rootName = 'Config'): string {
    let buffer = '';
    const structs: Map<string, string> = new Map();
    const toExported = (s: string) => this.capitalize(s.replace(/[^a-zA-Z0-9]/g, ''));

    const getTypeName = (val: any, key: string): string => {
      if (val === null) return 'interface{}';
      const type = typeof val;
      if (type === 'string') return 'string';
      if (type === 'number') return Number.isInteger(val) ? 'int' : 'float64';
      if (type === 'boolean') return 'bool';
      if (Array.isArray(val)) {
         if (val.length === 0) return '[]interface{}';
         return `[]${getTypeName(val[0], key)}`;
      }
      const structName = toExported(key) || 'Struct' + Math.floor(Math.random()*1000);
      if (!structs.has(structName)) {
         structs.set(structName, '');
         let def = `type ${structName} struct {\n`;
         Object.keys(val).forEach(k => {
            const exportedKey = toExported(k) || 'F_' + k;
            const fieldType = getTypeName(val[k], k);
            // Default tags for json, yaml, xml
            def += `\t${exportedKey} ${fieldType} \`json:"${k}" yaml:"${k}" xml:"${k}"\`\n`;
         });
         def += `}`;
         structs.set(structName, def);
      }
      return structName;
    };
    getTypeName(data, rootName);
    Array.from(structs.values()).forEach(def => buffer += def + '\n\n');
    return buffer.trim();
  }

  private capitalize(s: string) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
