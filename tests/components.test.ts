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
