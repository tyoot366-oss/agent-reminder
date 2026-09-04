import { test } from 'node:test';
import assert from 'node:assert';
import { applyReminderDefaults, validateReminderDate, validateReminderTime } from '../src/services/defaults.ts';

test('applyReminderDefaults: 缺失 time 与 repeat 时自动注入默认值 08:00 与 hourly', () => {
  const result = applyReminderDefaults({
    title: '买牛奶',
    date: '2026-09-05',
  });

  assert.strictEqual(result.title, '买牛奶');
  assert.strictEqual(result.date, '2026-09-05');
  assert.strictEqual(result.time, '08:00');
  assert.strictEqual(result.repeat, 'hourly');
  assert.strictEqual(result.isCompleted, false);
  assert.ok(result.id.startsWith('rem_'));
  assert.ok(result.createdAt > 0);
  assert.ok(result.updatedAt > 0);
});

test('applyReminderDefaults: 保留显式传入的 time 与 repeat', () => {
  const result = applyReminderDefaults({
    title: '团队周会',
    date: '2026-09-06',
    time: '14:30',
    repeat: 'weekly',
    notes: '带上周报',
  });

  assert.strictEqual(result.time, '14:30');
  assert.strictEqual(result.repeat, 'weekly');
  assert.strictEqual(result.notes, '带上周报');
});

test('validateReminderDate: 有效与无效日期格式判断', () => {
  assert.strictEqual(validateReminderDate('2026-09-05'), true);
  assert.strictEqual(validateReminderDate('invalid-date'), false);
  assert.strictEqual(validateReminderDate('2026-13-01'), false);
});

test('validateReminderTime: 有效与无效时间格式判断', () => {
  assert.strictEqual(validateReminderTime('08:00'), true);
  assert.strictEqual(validateReminderTime('23:59'), true);
  assert.strictEqual(validateReminderTime('25:00'), false);
  assert.strictEqual(validateReminderTime('bad-time'), false);
});
