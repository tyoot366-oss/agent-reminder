import type { CreateReminderInput, RepeatRule } from '../types/reminder.ts';
import { ReminderStorage, defaultStorage } from './storage.ts';
import { NotificationEngine, defaultNotificationEngine } from './notifications.ts';
import { applyReminderDefaults, validateReminderDate } from './defaults.ts';

export type ParsedUrlAction =
  | { type: 'create'; params: CreateReminderInput }
  | { type: 'list'; filter?: 'all' | 'pending' | 'completed' }
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string }
  | { type: 'unknown'; rawUrl: string; error: string };

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseUrlScheme(rawUrl: string): ParsedUrlAction {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'agentreminder:') {
      return { type: 'unknown', rawUrl, error: `Invalid protocol: ${parsed.protocol}` };
    }

    const hostnameOrPath = (parsed.hostname || parsed.pathname || '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    const searchParams = parsed.searchParams;

    if (hostnameOrPath === 'create') {
      const title = searchParams.get('title') || searchParams.get('text') || '';
      const date = searchParams.get('date') || getLocalDateString();
      const time = searchParams.get('time') || undefined;
      const repeatRaw = searchParams.get('repeat') || undefined;
      const notes = searchParams.get('notes') || undefined;
      const id = searchParams.get('id') || undefined;

      let repeat: RepeatRule | undefined;
      if (repeatRaw && ['none', 'half_hourly', 'hourly', 'daily', 'weekly'].includes(repeatRaw)) {
        repeat = repeatRaw as RepeatRule;
      }

      return {
        type: 'create',
        params: {
          id,
          title,
          date,
          time,
          repeat,
          notes,
        },
      };
    }

    if (hostnameOrPath === 'delete') {
      const id = searchParams.get('id') || '';
      return { type: 'delete', id };
    }

    if (hostnameOrPath === 'toggle') {
      const id = searchParams.get('id') || '';
      return { type: 'toggle', id };
    }

    if (hostnameOrPath === 'list') {
      const filterRaw = searchParams.get('filter');
      const filter = (filterRaw === 'pending' || filterRaw === 'completed') ? filterRaw : 'all';
      return { type: 'list', filter };
    }

    return { type: 'unknown', rawUrl, error: `Unsupported action: ${hostnameOrPath}` };
  } catch (err: any) {
    return { type: 'unknown', rawUrl, error: err?.message || 'Failed to parse URL' };
  }
}

export async function executeUrlAction(
  action: ParsedUrlAction,
  storage: ReminderStorage,
  notifications: NotificationEngine
): Promise<{ success: boolean; message: string; data?: any }> {
  switch (action.type) {
    case 'create': {
      if (!action.params.title || action.params.title.trim().length === 0) {
        return { success: false, message: '创建失败：必须提供 title 标题' };
      }
      if (!validateReminderDate(action.params.date)) {
        return { success: false, message: '创建失败：日期格式无效，必须为 YYYY-MM-DD' };
      }
      const reminder = applyReminderDefaults(action.params);
      await storage.save(reminder);
      await notifications.schedule(reminder);
      return {
        success: true,
        message: `已创建提醒「${reminder.title}」，将于 ${reminder.date} ${reminder.time} 触发（重复：${reminder.repeat}）`,
        data: reminder,
      };
    }
    case 'delete': {
      if (!action.id) {
        return { success: false, message: '删除失败：必须提供 id' };
      }
      const ok = await storage.delete(action.id);
      if (ok) {
        await notifications.cancel(action.id);
        return { success: true, message: `已成功删除提醒 ${action.id}` };
      }
      return { success: false, message: `未找到 ID 为 ${action.id} 的提醒` };
    }
    case 'toggle': {
      if (!action.id) {
        return { success: false, message: '切换失败：必须提供 id' };
      }
      const updated = await storage.toggleStatus(action.id);
      if (updated) {
        if (updated.isCompleted) {
          await notifications.cancel(action.id);
        } else {
          await notifications.schedule(updated);
        }
        return {
          success: true,
          message: `提醒状态已更新为：${updated.isCompleted ? '已完成' : '待办'}`,
          data: updated,
        };
      }
      return { success: false, message: `未找到 ID 为 ${action.id} 的提醒` };
    }
    case 'list': {
      const all = await storage.getAll();
      let filtered = all;
      if (action.filter === 'pending') {
        filtered = all.filter((i) => !i.isCompleted);
      } else if (action.filter === 'completed') {
        filtered = all.filter((i) => i.isCompleted);
      }
      return {
        success: true,
        message: `查询到 ${filtered.length} 条提醒`,
        data: filtered,
      };
    }
    case 'unknown':
      return { success: false, message: `无法识别的指令：${action.error}` };
  }
}

export async function handleIncomingUrl(
  rawUrl: string,
  storage: ReminderStorage = defaultStorage,
  notifications: NotificationEngine = defaultNotificationEngine
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!rawUrl) {
    return { success: false, message: 'URL 不能为空' };
  }
  const action = parseUrlScheme(rawUrl);
  return executeUrlAction(action, storage, notifications);
}

export function shouldProcessIncomingUrl(
  lastProcessed: { url: string; timestamp: number } | null,
  newUrl: string,
  now: number = Date.now(),
  windowMs: number = 1000
): boolean {
  if (!newUrl) return false;
  if (
    lastProcessed &&
    lastProcessed.url === newUrl &&
    now - lastProcessed.timestamp < windowMs
  ) {
    return false;
  }
  return true;
}


