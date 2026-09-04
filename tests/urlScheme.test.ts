import { test } from 'node:test';
import assert from 'node:assert';
import { parseUrlScheme, executeUrlAction } from '../src/services/urlScheme.ts';
import { ReminderStorage } from '../src/services/storage.ts';
import { NotificationEngine } from '../src/services/notifications.ts';

test('parseUrlScheme: 成功解析 agentreminder://create 并提取参数', () => {
  const url = 'agentreminder://create?title=%E4%B9%B0%E7%89%9B%E5%A5%B6&date=2026-09-05&time=09:30&repeat=daily&notes=%E4%BE%BF%E5%88%A9%E5%BA%97';
  const action = parseUrlScheme(url);

  assert.strictEqual(action.type, 'create');
  if (action.type === 'create') {
    assert.strictEqual(action.params.title, '买牛奶');
    assert.strictEqual(action.params.date, '2026-09-05');
    assert.strictEqual(action.params.time, '09:30');
    assert.strictEqual(action.params.repeat, 'daily');
    assert.strictEqual(action.params.notes, '便利店');
  }
});

test('parseUrlScheme: 成功解析 delete 与 toggle 动作', () => {
  const delAction = parseUrlScheme('agentreminder://delete?id=rem_123');
  assert.strictEqual(delAction.type, 'delete');
  if (delAction.type === 'delete') {
    assert.strictEqual(delAction.id, 'rem_123');
  }

  const toggleAction = parseUrlScheme('agentreminder://toggle?id=rem_456');
  assert.strictEqual(toggleAction.type, 'toggle');
  if (toggleAction.type === 'toggle') {
    assert.strictEqual(toggleAction.id, 'rem_456');
  }
});

test('parseUrlScheme: 成功解析 list 动作及不同 filter 参数', () => {
  const listAll = parseUrlScheme('agentreminder://list');
  assert.strictEqual(listAll.type, 'list');
  if (listAll.type === 'list') {
    assert.strictEqual(listAll.filter, 'all');
  }

  const listPending = parseUrlScheme('agentreminder://list?filter=pending');
  assert.strictEqual(listPending.type, 'list');
  if (listPending.type === 'list') {
    assert.strictEqual(listPending.filter, 'pending');
  }

  const listCompleted = parseUrlScheme('agentreminder://list?filter=completed');
  assert.strictEqual(listCompleted.type, 'list');
  if (listCompleted.type === 'list') {
    assert.strictEqual(listCompleted.filter, 'completed');
  }
});

test('parseUrlScheme: 容错处理（非 agentreminder 协议与未知动作）', () => {
  const invalidProto = parseUrlScheme('https://example.com/create');
  assert.strictEqual(invalidProto.type, 'unknown');
  if (invalidProto.type === 'unknown') {
    assert.ok(invalidProto.error.includes('Invalid protocol'));
  }

  const unsupportedAction = parseUrlScheme('agentreminder://unsupported_action?foo=bar');
  assert.strictEqual(unsupportedAction.type, 'unknown');
  if (unsupportedAction.type === 'unknown') {
    assert.ok(unsupportedAction.error.includes('Unsupported action'));
  }

  const invalidUrl = parseUrlScheme('not a valid url');
  assert.strictEqual(invalidUrl.type, 'unknown');
});

test('executeUrlAction: 自动补全默认值并存入 storage', async () => {
  const memoryAdapter = new Map<string, string>();
  const storage = new ReminderStorage({
    async getItem(k) { return memoryAdapter.get(k) || null; },
    async setItem(k, v) { memoryAdapter.set(k, v); },
    async removeItem(k) { memoryAdapter.delete(k); },
  });
  const notifications = new NotificationEngine();

  // 执行创建动作（不传 time 和 repeat）
  const action = parseUrlScheme('agentreminder://create?title=%E5%96%9D%E6%B0%B4&date=2026-09-05');
  const result = await executeUrlAction(action, storage, notifications);

  assert.strictEqual(result.success, true);
  assert.ok(result.data);
  assert.strictEqual(result.data.title, '喝水');
  assert.strictEqual(result.data.time, '08:00');      // 默认注入 08:00
  assert.strictEqual(result.data.repeat, 'hourly');   // 默认注入 hourly
});

test('executeUrlAction: 完整流程覆盖 (create 标题为空校验失败, list 过滤, toggle, delete)', async () => {
  const memoryAdapter = new Map<string, string>();
  const storage = new ReminderStorage({
    async getItem(k) { return memoryAdapter.get(k) || null; },
    async setItem(k, v) { memoryAdapter.set(k, v); },
    async removeItem(k) { memoryAdapter.delete(k); },
  });
  const notifications = new NotificationEngine();

  // 1. 创建标题为空 -> 失败
  const emptyTitleAction = parseUrlScheme('agentreminder://create?title=%20%20');
  const emptyResult = await executeUrlAction(emptyTitleAction, storage, notifications);
  assert.strictEqual(emptyResult.success, false);
  assert.ok(emptyResult.message.includes('必须提供 title'));

  // 2. 正常创建 2 条任务
  const item1Action = parseUrlScheme('agentreminder://create?title=Task1&date=2026-09-05&time=10:00&repeat=daily');
  const r1 = await executeUrlAction(item1Action, storage, notifications);
  assert.strictEqual(r1.success, true);
  const id1 = r1.data.id;

  const item2Action = parseUrlScheme('agentreminder://create?title=Task2&date=2026-09-06');
  const r2 = await executeUrlAction(item2Action, storage, notifications);
  assert.strictEqual(r2.success, true);
  const id2 = r2.data.id;

  // 3. list all
  const listAllResult = await executeUrlAction(parseUrlScheme('agentreminder://list'), storage, notifications);
  assert.strictEqual(listAllResult.success, true);
  assert.strictEqual(listAllResult.data.length, 2);

  // 4. toggle 状态 (将 id1 标记为完成)
  const toggleResult = await executeUrlAction(parseUrlScheme(`agentreminder://toggle?id=${id1}`), storage, notifications);
  assert.strictEqual(toggleResult.success, true);
  assert.strictEqual(toggleResult.data.isCompleted, true);

  // 5. list pending / completed
  const pendingResult = await executeUrlAction(parseUrlScheme('agentreminder://list?filter=pending'), storage, notifications);
  assert.strictEqual(pendingResult.data.length, 1);
  assert.strictEqual(pendingResult.data[0].id, id2);

  const completedResult = await executeUrlAction(parseUrlScheme('agentreminder://list?filter=completed'), storage, notifications);
  assert.strictEqual(completedResult.data.length, 1);
  assert.strictEqual(completedResult.data[0].id, id1);

  // 6. delete
  const deleteResult = await executeUrlAction(parseUrlScheme(`agentreminder://delete?id=${id1}`), storage, notifications);
  assert.strictEqual(deleteResult.success, true);
  assert.strictEqual(notifications.isScheduled(id1), false);

  // 7. toggle 和 delete 不存在的 id
  const toggleNotFound = await executeUrlAction(parseUrlScheme('agentreminder://toggle?id=non_existent'), storage, notifications);
  assert.strictEqual(toggleNotFound.success, false);

  const deleteNotFound = await executeUrlAction(parseUrlScheme('agentreminder://delete?id=non_existent'), storage, notifications);
  assert.strictEqual(deleteNotFound.success, false);

  // 8. unknown 指令
  const unknownResult = await executeUrlAction(parseUrlScheme('agentreminder://unknown_command'), storage, notifications);
  assert.strictEqual(unknownResult.success, false);
});
