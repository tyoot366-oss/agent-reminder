import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateTriggerDate,
  getRepeatIntervalDescription,
  buildNotificationSchedule,
  NotificationEngine,
} from '../src/services/notifications.ts';
import { applyReminderDefaults } from '../src/services/defaults.ts';

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
