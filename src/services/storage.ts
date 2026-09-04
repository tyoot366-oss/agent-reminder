import type { ReminderItem } from '../types/reminder.ts';

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

export class ReminderStorage {
  private backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    this.backend = backend || new LocalMemoryBackend();
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
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    const list = await this.getAll();
    const filtered = list.filter((i) => i.id !== id);
    if (filtered.length === list.length) {
      return false;
    }
    await this.backend.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
