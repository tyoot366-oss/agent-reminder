import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateTriggerDate,
  calculateNextTriggerDate,
  getRepeatIntervalDescription,
  buildNotificationSchedule,
  NotificationEngine,
} from '../src/services/notifications.ts';
import { applyReminderDefaults } from '../src/services/defaults.ts';

test('calculateNextTriggerDate: 核心调度规则验证', () => {
  const fakeNow = new Date(2026, 8, 7, 10, 30, 0, 0); // 2026-09-07 10:30:00

  // 1. 目标时间在未来（如今天 14:00）：首个触发时间必须为未来目标时间，绝不提前
  const futureTarget = new Date(2026, 8, 7, 14, 0, 0, 0);
  const nextHourly = calculateNextTriggerDate(futureTarget, 'hourly', fakeNow);
  assert.strictEqual(nextHourly?.getTime(), futureTarget.getTime());

  // 2. 目标时间已过期且不重复（none）：返回 null，避免创建后立即触发
  const pastTarget = new Date(2026, 8, 7, 8, 0, 0, 0); // 08:00 已过去
  const nextNone = calculateNextTriggerDate(pastTarget, 'none', fakeNow);
  assert.strictEqual(nextNone, null);

  // 3. 目标时间已过期但为 hourly：推算至未来下一个小时的对应分钟（11:00）
  const nextHourlyFromPast = calculateNextTriggerDate(pastTarget, 'hourly', fakeNow);
  assert.strictEqual(nextHourlyFromPast?.getHours(), 11);
  assert.strictEqual(nextHourlyFromPast?.getMinutes(), 0);

  // 4. 目标时间已过期但为 half_hourly：推算至未来的下一个 30 分钟节点（11:00）
  const nextHalfFromPast = calculateNextTriggerDate(pastTarget, 'half_hourly', fakeNow);
  assert.strictEqual(nextHalfFromPast?.getHours(), 11);
  assert.strictEqual(nextHalfFromPast?.getMinutes(), 0);

  // 5. 目标时间已过期但为 daily：推算至明天的 08:00
  const nextDailyFromPast = calculateNextTriggerDate(pastTarget, 'daily', fakeNow);
  assert.strictEqual(nextDailyFromPast?.getDate(), 8);
  assert.strictEqual(nextDailyFromPast?.getHours(), 8);
  assert.strictEqual(nextDailyFromPast?.getMinutes(), 0);

  // 6. 目标时间已过期但为 weekly：推算至下周同一天的 08:00
  const nextWeeklyFromPast = calculateNextTriggerDate(pastTarget, 'weekly', fakeNow);
  assert.strictEqual(nextWeeklyFromPast?.getDate(), 14);
  assert.strictEqual(nextWeeklyFromPast?.getHours(), 8);
});

test('calculateTriggerDate: 正确解析年月日与时分', () => {
  const d = calculateTriggerDate('2026-09-05', '08:00');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 8); // 0-indexed, 8 is September
  assert.strictEqual(d.getDate(), 5);
  assert.strictEqual(d.getHours(), 8);
  assert.strictEqual(d.getMinutes(), 0);
});

test('buildNotificationSchedule: 各种重复模式计算规则', () => {
  // 1. none
  const noneItem = applyReminderDefaults({ title: '开会', date: '2026-09-05', time: '10:00', repeat: 'none' });
  const noneSchedule = buildNotificationSchedule(noneItem);
  assert.strictEqual(noneSchedule.triggerType, 'calendar');
  assert.strictEqual(noneSchedule.repeats, false);

  // 2. half_hourly
  const halfItem = applyReminderDefaults({ title: '喝水', date: '2026-09-05', time: '08:00', repeat: 'half_hourly' });
  const halfSchedule = buildNotificationSchedule(halfItem);
  assert.strictEqual(halfSchedule.triggerType, 'interval');
  assert.strictEqual(halfSchedule.repeats, true);
  assert.strictEqual(halfSchedule.intervalSeconds, 1800);

  // 3. hourly
  const hourlyItem = applyReminderDefaults({ title: '久坐提醒', date: '2026-09-05', time: '08:00', repeat: 'hourly' });
  const hourlySchedule = buildNotificationSchedule(hourlyItem);
  assert.strictEqual(hourlySchedule.triggerType, 'calendar');
  assert.strictEqual(hourlySchedule.repeats, true);

  // 4. daily
  const dailyItem = applyReminderDefaults({ title: '早报', date: '2026-09-05', time: '08:00', repeat: 'daily' });
  const dailySchedule = buildNotificationSchedule(dailyItem);
  assert.strictEqual(dailySchedule.triggerType, 'calendar');
  assert.strictEqual(dailySchedule.repeats, true);

  // 5. weekly
  const weeklyItem = applyReminderDefaults({ title: '周会', date: '2026-09-05', time: '08:00', repeat: 'weekly' });
  const weeklySchedule = buildNotificationSchedule(weeklyItem);
  assert.strictEqual(weeklySchedule.triggerType, 'calendar');
  assert.strictEqual(weeklySchedule.repeats, true);
});

test('getRepeatIntervalDescription: 中文易读描述', () => {
  assert.strictEqual(getRepeatIntervalDescription('none'), '不重复');
  assert.strictEqual(getRepeatIntervalDescription('half_hourly'), '每半小时');
  assert.strictEqual(getRepeatIntervalDescription('hourly'), '每小时');
  assert.strictEqual(getRepeatIntervalDescription('daily'), '每日');
  assert.strictEqual(getRepeatIntervalDescription('weekly'), '每周');
});

test('NotificationEngine: 调度与取消及权限检查', async () => {
  const engine = new NotificationEngine();
  const perm = await engine.requestPermissions();
  assert.strictEqual(typeof perm, 'boolean');

  const item = applyReminderDefaults({ title: '测试引擎', date: '2026-09-05', time: '08:00' });
  const notifId = await engine.schedule(item);
  assert.strictEqual(notifId, item.id);
  assert.strictEqual(engine.isScheduled(notifId), true);

  await engine.cancel(notifId);
  assert.strictEqual(engine.isScheduled(notifId), false);
});
