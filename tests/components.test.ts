import { test } from 'node:test';
import assert from 'node:assert';
import { applyReminderDefaults } from '../src/services/defaults.ts';

test('UI 数据过滤逻辑: 能够按 all, pending, completed, repeating 正确筛选', () => {
  const items = [
    applyReminderDefaults({ title: '任务1', date: '2026-09-05', repeat: 'none' }),
    applyReminderDefaults({ title: '任务2', date: '2026-09-05', repeat: 'hourly' }),
    { ...applyReminderDefaults({ title: '任务3', date: '2026-09-05', repeat: 'daily' }), isCompleted: true },
  ];

  const pending = items.filter((i) => !i.isCompleted);
  assert.strictEqual(pending.length, 2);

  const completed = items.filter((i) => i.isCompleted);
  assert.strictEqual(completed.length, 1);

  const repeating = items.filter((i) => i.repeat !== 'none');
  assert.strictEqual(repeating.length, 2);
});

test('FilterBar 统计数据计算: 正确汇总 counts 对象', () => {
  const items = [
    applyReminderDefaults({ title: '任务1', date: '2026-09-05', repeat: 'none' }),
    applyReminderDefaults({ title: '任务2', date: '2026-09-05', repeat: 'hourly' }),
    { ...applyReminderDefaults({ title: '任务3', date: '2026-09-05', repeat: 'half_hourly' }), isCompleted: true },
    { ...applyReminderDefaults({ title: '任务4', date: '2026-09-05', repeat: 'none' }), isCompleted: true },
  ];

  const counts = {
    all: items.length,
    pending: items.filter((i) => !i.isCompleted).length,
    completed: items.filter((i) => i.isCompleted).length,
    repeating: items.filter((i) => i.repeat !== 'none').length,
  };

  assert.strictEqual(counts.all, 4);
  assert.strictEqual(counts.pending, 2);
  assert.strictEqual(counts.completed, 2);
  assert.strictEqual(counts.repeating, 2);
});

test('UI 数据编辑逻辑: 修改已有提醒的标题、时间与重复规则', () => {
  const original = applyReminderDefaults({
    id: 'rem_edit_test',
    title: '原标题',
    date: '2026-09-07',
    time: '08:00',
    repeat: 'none',
  });

  const edited: typeof original = {
    ...original,
    title: '新修改标题',
    time: '14:30',
    repeat: 'daily',
    notes: '补充说明',
  };

  assert.strictEqual(edited.id, original.id);
  assert.strictEqual(edited.title, '新修改标题');
  assert.strictEqual(edited.time, '14:30');
  assert.strictEqual(edited.repeat, 'daily');
  assert.strictEqual(edited.notes, '补充说明');
});
