import type { ReminderItem, RepeatRule } from '../types/reminder.ts';

export interface NotificationScheduleInfo {
  triggerType: 'calendar' | 'interval';
  repeats: boolean;
  targetDate: Date;
  intervalSeconds?: number;
}

export function calculateTriggerDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function getRepeatIntervalDescription(repeat: RepeatRule): string {
  switch (repeat) {
    case 'none':
      return '不重复';
    case 'half_hourly':
      return '每半小时';
    case 'hourly':
      return '每小时';
    case 'daily':
      return '每日';
    case 'weekly':
      return '每周';
  }
}

export function buildNotificationSchedule(reminder: ReminderItem): NotificationScheduleInfo {
  const targetDate = calculateTriggerDate(reminder.date, reminder.time);

  switch (reminder.repeat) {
    case 'none':
      return {
        triggerType: 'calendar',
        repeats: false,
        targetDate,
      };
    case 'half_hourly':
      return {
        triggerType: 'interval',
        repeats: true,
        targetDate,
        intervalSeconds: 1800,
      };
    case 'hourly':
    case 'daily':
    case 'weekly':
      return {
        triggerType: 'calendar',
        repeats: true,
        targetDate,
      };
  }
}

export class NotificationEngine {
  private activeNotificationIds = new Set<string>();

  async requestPermissions(): Promise<boolean> {
    if (typeof Notification !== 'undefined') {
      const status = await Notification.requestPermission();
      return status === 'granted';
    }
    return true;
  }

  async schedule(reminder: ReminderItem): Promise<string> {
    const scheduleInfo = buildNotificationSchedule(reminder);
    const notificationId = reminder.notificationId || reminder.id;
    this.activeNotificationIds.add(notificationId);
    return notificationId;
  }

  async cancel(notificationId: string): Promise<void> {
    this.activeNotificationIds.delete(notificationId);
  }

  isScheduled(notificationId: string): boolean {
    return this.activeNotificationIds.has(notificationId);
  }
}

export const defaultNotificationEngine = new NotificationEngine();
