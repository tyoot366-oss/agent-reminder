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

/**
 * 计算未来的下一个有效触发时间：
 * 1. 如果 targetDate 还在未来（> now），首次触发时间严格等于 targetDate（绝不提前触发）
 * 2. 如果 targetDate 已是过去时间（<= now）：
 *    - repeat === 'none'：已过期，返回 null（避免创建后立即误触发）
 *    - repeat !== 'none'：步进推算到未来的第一个有效触发点
 */
export function calculateNextTriggerDate(
  targetDate: Date,
  repeat: RepeatRule,
  now: Date = new Date()
): Date | null {
  if (targetDate.getTime() > now.getTime()) {
    return new Date(targetDate.getTime());
  }

  if (repeat === 'none') {
    return null;
  }

  const next = new Date(targetDate.getTime());

  switch (repeat) {
    case 'half_hourly':
      while (next.getTime() <= now.getTime()) {
        next.setMinutes(next.getMinutes() + 30);
      }
      return next;
    case 'hourly':
      while (next.getTime() <= now.getTime()) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    case 'daily':
      while (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    case 'weekly':
      while (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 7);
      }
      return next;
  }
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

export function buildNotificationSchedule(
  reminder: ReminderItem,
  now: Date = new Date()
): NotificationScheduleInfo {
  const targetDate = calculateTriggerDate(reminder.date, reminder.time);
  const nextTrigger = calculateNextTriggerDate(targetDate, reminder.repeat, now) || targetDate;

  switch (reminder.repeat) {
    case 'none':
      return {
        triggerType: 'calendar',
        repeats: false,
        targetDate: nextTrigger,
      };
    case 'half_hourly':
      return {
        triggerType: 'interval',
        repeats: true,
        targetDate: nextTrigger,
        intervalSeconds: 1800,
      };
    case 'hourly':
    case 'daily':
    case 'weekly':
      return {
        triggerType: 'calendar',
        repeats: true,
        targetDate: nextTrigger,
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
      const nextTrigger = calculateNextTriggerDate(targetDate, reminder.repeat);

      // 已过期的一次性提醒不调度，避免刚创建就触发
      if (!nextTrigger) {
        return notificationId;
      }

      await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});

      let trigger: any;
      const msUntilNext = nextTrigger.getTime() - Date.now();

      switch (reminder.repeat) {
        case 'none':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
          break;
        case 'half_hourly':
          // 如果首个触发时间在 30 分钟以内，使用一次性倒计时到首个触发点，到点触发
          const secondsUntilFirst = Math.max(1, Math.round(msUntilNext / 1000));
          if (secondsUntilFirst <= 1800) {
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: secondsUntilFirst,
              repeats: false,
            };
          } else {
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
          }
          break;
        case 'hourly':
          // 只有在首个触发时间在 1 小时内时，才使用 CALENDAR minute 重复触发
          // 若触发时间在未来数小时或明天，必须用精确 DATE，避免提前触发
          if (msUntilNext <= 3600 * 1000) {
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              minute: nextTrigger.getMinutes(),
              repeats: true,
            };
          } else {
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
          }
          break;
        case 'daily':
          // 首个触发时间在 24 小时内时，使用 CALENDAR hour+minute
          if (msUntilNext <= 24 * 3600 * 1000) {
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              hour: nextTrigger.getHours(),
              minute: nextTrigger.getMinutes(),
              repeats: true,
            };
          } else {
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
          }
          break;
        case 'weekly':
          // 首个触发时间在 7 天内时，使用 CALENDAR weekday+hour+minute
          if (msUntilNext <= 7 * 24 * 3600 * 1000) {
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              weekday: nextTrigger.getDay() + 1,
              hour: nextTrigger.getHours(),
              minute: nextTrigger.getMinutes(),
              repeats: true,
            };
          } else {
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
          }
          break;
        default:
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextTrigger };
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
