import type { ReminderItem } from '../types/reminder.ts';

let FileSystem: typeof import('expo-file-system') | undefined;
if (typeof process === 'undefined' || process.env.EXPO_OS) {
  FileSystem = require('expo-file-system');
}

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const STORAGE_KEY = 'agent_reminders_v1';

class LocalMemoryBackend implements StorageBackend {
  private cache = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return this.cache.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    this.cache.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    this.cache.delete(key);
  }
}

class FileSystemBackend implements StorageBackend {
  private customFs: any;

  constructor(customFs?: any) {
    this.customFs = customFs;
  }

  private getFs(): any {
    return this.customFs || FileSystem;
  }

  private getTargetFile(): any {
    const fs = this.getFs();
    if (!fs) return null;
    const { Paths, File } = fs;
    if (!File || !Paths) return null;

    try {
      let container = Paths.appleSharedContainers?.['group.com.anonymous.myapp'];
      if (!container) {
        container = Paths.document;
      }
      return new File(container, 'reminders.json');
    } catch {
      try {
        return new File(Paths.document, 'reminders.json');
      } catch {
        return null;
      }
    }
  }

  async getItem(key: string): Promise<string | null> {
    const fs = this.getFs();
    if (!fs) return null;
    try {
      const file = this.getTargetFile();
      if (file && file.exists) {
        return await file.text();
      }
      return null;
    } catch (err) {
      console.warn('Failed to read from FileSystem:', err);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const fs = this.getFs();
    if (!fs) return;
    try {
      const file = this.getTargetFile();
      if (!file) return;

      if (!file.exists) {
        try {
          file.create();
        } catch {}
      }
      file.write(value);
    } catch (err) {
      console.warn('Failed to write to FileSystem:', err);
    }
  }

  async removeItem(key: string): Promise<void> {
    const fs = this.getFs();
    if (!fs) return;
    try {
      const file = this.getTargetFile();
      if (file && file.exists) {
        file.delete();
      }
    } catch (err) {
      console.warn('Failed to remove from FileSystem:', err);
    }
  }
}
export { FileSystemBackend };

export class ReminderStorage {
  private backend: StorageBackend;
  private listeners = new Set<() => void>();

  constructor(backend?: StorageBackend) {
    if (backend) {
      this.backend = backend;
    } else if (typeof process !== 'undefined' && !process.env.EXPO_OS) {
      this.backend = new LocalMemoryBackend();
    } else {
      this.backend = new FileSystemBackend();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }

  async getAll(): Promise<ReminderItem[]> {
    try {
      const raw = await this.backend.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<ReminderItem | null> {
    const list = await this.getAll();
    return list.find((i) => i.id === id) || null;
  }

  async save(item: ReminderItem): Promise<ReminderItem> {
    const list = await this.getAll();
    const index = list.findIndex((i) => i.id === item.id);
    const updatedItem = { ...item, updatedAt: Date.now() };

    if (index >= 0) {
      list[index] = updatedItem;
    } else {
      list.unshift(updatedItem);
    }

    await this.backend.setItem(STORAGE_KEY, JSON.stringify(list));
    this.notify();
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    const list = await this.getAll();
    const filtered = list.filter((i) => i.id !== id);
    if (filtered.length === list.length) {
      return false;
    }
    await this.backend.setItem(STORAGE_KEY, JSON.stringify(filtered));
    this.notify();
    return true;
  }

  async toggleStatus(id: string): Promise<ReminderItem | null> {
    const item = await this.getById(id);
    if (!item) return null;
    item.isCompleted = !item.isCompleted;
    return this.save(item);
  }
}

export const defaultStorage = new ReminderStorage();
