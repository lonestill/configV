import { Injectable } from '@angular/core';

export interface FileSystemEntry {
  name: string;
  handle: FileSystemFileHandle | MockFileHandle;
  kind: 'file';
}

export interface MockFileHandle {
  getFile: () => Promise<File>;
  kind: 'file';
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileSystemService {
  
  // prompt the user to select a directory and read its contents
  async openFolder(): Promise<FileSystemEntry[]> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('FileSystemAccessUnsupported');
    }

    try {
      // @ts-ignore - Types might not be fully available in all envs yet
      const dirHandle = await window.showDirectoryPicker();
      const files: FileSystemEntry[] = [];
      
      // Read root directory entries
      // @ts-ignore
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && this.isConfigFile(entry.name)) {
           files.push({ name: entry.name, handle: entry, kind: 'file' });
        }
      }
      
      return files.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      // Propagate error to let component handle fallback (e.g. standard input)
      // unless it is just a user cancellation
      if ((err as Error).name === 'AbortError') {
        return [];
      }
      throw err;
    }
  }

  async readFile(handle: FileSystemFileHandle | MockFileHandle): Promise<File> {
    return await handle.getFile();
  }

  public isConfigFile(name: string): boolean {
    const n = name.toLowerCase();
    return n.endsWith('.json') || 
           n.endsWith('.yaml') || 
           n.endsWith('.yml') || 
           n.endsWith('.ini') || 
           n.endsWith('.xml') || 
           n.endsWith('.config') || 
           n.endsWith('.env') ||
           n.startsWith('.env'); // e.g. .env.local
  }
}
