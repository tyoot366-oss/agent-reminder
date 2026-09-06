import type { ReminderItem, RepeatRule } from '../types/reminder.ts';

let Notifications: typeof import('expo-notifications') | undefined;
if (typeof process === 'undefined' || process.env.EXPO_OS) {
  Notifications = require('expo-notifications');
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

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

  private isNodeTest(): boolean {
    return typeof process !== 'undefined' && !process.env.EXPO_OS;
  }

  async getNotificationPermissionStatus(): Promise<boolean> {
    if (this.isNodeTest() || !Notifications) return true;
    try {
      const settings = await Notifications.getPermissionsAsync();
      return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    } catch (e) {
      console.warn('Failed to read notification permission', e);
      return true;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (this.isNodeTest() || !Notifications) return true;
    try {
      const settings = await Notifications.requestPermissionsAsync();
      const granted =
        settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      if (!granted) {
        console.warn('Notification permission not granted:', settings);
      }
      return granted;
    } catch (e) {
      console.warn('Failed to request notification permission', e);
      return false;
    }
  }

  async schedule(reminder: ReminderItem): Promise<string> {
    const notificationId = reminder.notificationId || reminder.id;
    this.activeNotificationIds.add(notificationId);
    
    if (this.isNodeTest() || !Notifications) {
      return notificationId;
    }

    try {
      const targetDate = calculateTriggerDate(reminder.date, reminder.time);
      let trigger: any; // Use any to avoid complex TS types conditionally

      switch (reminder.repeat) {
        case 'none':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: targetDate };
          break;
        case 'half_hourly':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1800, repeats: true };
          break;
        case 'hourly':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, minute: targetDate.getMinutes(), repeats: true };
          break;
        case 'daily':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: targetDate.getHours(), minute: targetDate.getMinutes(), repeats: true };
          break;
        case 'weekly':
          trigger = { 
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            weekday: targetDate.getDay() + 1,
            hour: targetDate.getHours(), 
            minute: targetDate.getMinutes(), 
            repeats: true 
          };
          break;
        default:
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: targetDate };
      }

      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: reminder.title,
          body: reminder.notes || '',
          sound: 'default',
        },
        trigger,
      });
    } catch (e) {
      console.warn('Failed to schedule native notification', e);
    }
    
    return notificationId;
  }

  async cancel(notificationId: string): Promise<void> {
    this.activeNotificationIds.delete(notificationId);
    if (this.isNodeTest() || !Notifications) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}
  }

  isScheduled(notificationId: string): boolean {
    return this.activeNotificationIds.has(notificationId);
  }
}

export const defaultNotificationEngine = new NotificationEngine();
