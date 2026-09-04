import type { ReminderItem, CreateReminderInput, RepeatRule } from '../types/reminder.ts';

export const DEFAULT_TIME = '08:00';
export const DEFAULT_REPEAT: RepeatRule = 'hourly';

export function generateReminderId(): string {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `rem_${Date.now()}_${randomStr}`;
}

export function validateReminderDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function validateReminderTime(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    return false;
  }
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function applyReminderDefaults(input: CreateReminderInput): ReminderItem {
  const now = Date.now();
  const time = input.time && validateReminderTime(input.time) ? input.time : DEFAULT_TIME;
  const repeat: RepeatRule = input.repeat || DEFAULT_REPEAT;
  const id = input.id && input.id.trim().length > 0 ? input.id.trim() : generateReminderId();

  return {
    id,
    title: input.title.trim(),
    notes: input.notes ? input.notes.trim() : '',
    date: input.date.trim(),
    time,
    repeat,
    isCompleted: false,
    createdAt: now,
    updatedAt: now,
    notificationId: id,
  };
}
