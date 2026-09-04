import { test } from 'node:test';
import assert from 'node:assert';
import {
  applyReminderDefaults,
  filterReminders,
  computeFilterCounts,
} from '../src/services/defaults.ts';
import { ReminderStorage } from '../src/services/storage.ts';
import { NotificationEngine } from '../src/services/notifications.ts';
import {
  parseUrlScheme,
  executeUrlAction,
  handleIncomingUrl,
} from '../src/services/urlScheme.ts';
import type { ReminderItem } from '../src/types/reminder.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return new ReminderStorage({
    async getItem(key: string) {
      return map.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      map.set(key, value);
    },
    async removeItem(key: string) {
      map.delete(key);
    },
  });
}

test('Screen 状态筛选与计数逻辑: 正确按 all, pending, completed, repeating 过滤与统计', () => {
  const sampleItems: ReminderItem[] = [
    applyReminderDefaults({ title: '待办非重复', date: '2026-09-05', repeat: 'none' }),
    applyReminderDefaults({ title: '待办每小时', date: '2026-09-05', repeat: 'hourly' }),
    applyReminderDefaults({ title: '待办每天', date: '2026-09-05', repeat: 'daily' }),
    {
      ...applyReminderDefaults({ title: '已完成单次', date: '2026-09-04', repeat: 'none' }),
      isCompleted: true,
    },
    {
      ...applyReminderDefaults({ title: '已完成循环', date: '2026-09-04', repeat: 'half_hourly' }),
      isCompleted: true,
    },
  ];

  // 1. 全部
  const allList = filterReminders(sampleItems, 'all');
  assert.strictEqual(allList.length, 5);

  // 2. 待办 (3项)
  const pendingList = filterReminders(sampleItems, 'pending');
  assert.strictEqual(pendingList.length, 3);
  assert.ok(pendingList.every((i) => !i.isCompleted));

  // 3. 已完成 (2项)
  const completedList = filterReminders(sampleItems, 'completed');
  assert.strictEqual(completedList.length, 2);
  assert.ok(completedList.every((i) => i.isCompleted));

  // 4. 循环中 (3项: hourly, daily, half_hourly)
  const repeatingList = filterReminders(sampleItems, 'repeating');
  assert.strictEqual(repeatingList.length, 3);
  assert.ok(repeatingList.every((i) => i.repeat !== 'none'));

  // 5. FilterBar 统计计数计算
  const counts = computeFilterCounts(sampleItems);
  assert.deepStrictEqual(counts, {
    all: 5,
    pending: 3,
    completed: 2,
    repeating: 3,
  });
});

test('Screen 交互状态变更测试: 标记完成、删除与新增后筛选及计数即时响应', () => {
  let items: ReminderItem[] = [
    applyReminderDefaults({ id: 'item-1', title: '任务1', date: '2026-09-05', repeat: 'none' }),
    applyReminderDefaults({ id: 'item-2', title: '任务2', date: '2026-09-05', repeat: 'hourly' }),
  ];

  // 初始计数: 2 all, 2 pending, 0 completed, 1 repeating
  assert.deepStrictEqual(computeFilterCounts(items), {
    all: 2,
    pending: 2,
    completed: 0,
    repeating: 1,
  });

  // 模拟用户标记 item-1 完成
  items = items.map((i) => (i.id === 'item-1' ? { ...i, isCompleted: true } : i));
  assert.strictEqual(filterReminders(items, 'pending').length, 1);
  assert.strictEqual(filterReminders(items, 'completed').length, 1);
  assert.deepStrictEqual(computeFilterCounts(items), {
    all: 2,
    pending: 1,
    completed: 1,
    repeating: 1,
  });

  // 模拟用户新增提醒
  const newItem = applyReminderDefaults({
    title: '新循环任务',
    date: '2026-09-05',
    repeat: 'daily',
  });
  items = [newItem, ...items];
  assert.strictEqual(filterReminders(items, 'all').length, 3);
  assert.strictEqual(filterReminders(items, 'repeating').length, 2);

  // 模拟用户删除 item-2
  items = items.filter((i) => i.id !== 'item-2');
  assert.strictEqual(filterReminders(items, 'all').length, 2);
  assert.deepStrictEqual(computeFilterCounts(items), {
    all: 2,
    pending: 1,
    completed: 1,
    repeating: 1,
  });
});

test('URL Scheme 监听流程: handleIncomingUrl 全协议动作处理与通知同步', async () => {
  const storage = createMemoryStorage();
  const notifications = new NotificationEngine();

  // 模拟 Linking.addEventListener('url', handleUrl) 接收到外部 Agent 创建请求
  const createUrl =
    'agentreminder://create?title=%E6%8F%90%E4%BA%A4%E4%BB%A3%E7%A0%81&date=2026-09-05&time=18:00&repeat=daily&notes=%E5%90%8C%E6%AD%A5PR';
  const createResult = await handleIncomingUrl(createUrl, storage, notifications);

  assert.strictEqual(createResult.success, true);
  assert.ok(createResult.data);
  const createdId = createResult.data.id;
  assert.strictEqual(createResult.data.title, '提交代码');
  assert.strictEqual(createResult.data.time, '18:00');
  assert.strictEqual(createResult.data.repeat, 'daily');
  assert.strictEqual(createResult.data.notes, '同步PR');

  // 验证 Storage 中存在此提醒
  const stored = await storage.getById(createdId);
  assert.ok(stored);
  assert.strictEqual(stored?.title, '提交代码');

  // 验证通知调度已挂载
  assert.strictEqual(notifications.isScheduled(createdId), true);

  // 模拟接收到 toggle 动作
  const toggleUrl = `agentreminder://toggle?id=${createdId}`;
  const toggleResult = await handleIncomingUrl(toggleUrl, storage, notifications);
  assert.strictEqual(toggleResult.success, true);
  assert.strictEqual(toggleResult.data?.isCompleted, true);

  // 标记完成后，通知已被取消
  assert.strictEqual(notifications.isScheduled(createdId), false);

  // 再次 toggle，恢复待办，重新调度通知
  const toggleBackResult = await handleIncomingUrl(toggleUrl, storage, notifications);
  assert.strictEqual(toggleBackResult.success, true);
  assert.strictEqual(toggleBackResult.data?.isCompleted, false);
  assert.strictEqual(notifications.isScheduled(createdId), true);

  // 模拟接收到 delete 动作
  const deleteUrl = `agentreminder://delete?id=${createdId}`;
  const deleteResult = await handleIncomingUrl(deleteUrl, storage, notifications);
  assert.strictEqual(deleteResult.success, true);

  // Storage 中已被删除且通知已被注销
  const afterDelete = await storage.getById(createdId);
  assert.strictEqual(afterDelete, null);
  assert.strictEqual(notifications.isScheduled(createdId), false);
});

test('URL Scheme 监听流程: 缺省字段自动注入默认规则 (08:00, hourly)', async () => {
  const storage = createMemoryStorage();
  const notifications = new NotificationEngine();

  // 极简调用：仅传入标题
  const minimalUrl = 'agentreminder://create?title=%E6%97%A9%E8%B5%B7%E9%94%BB%E7%82%BC';
  const result = await handleIncomingUrl(minimalUrl, storage, notifications);

  assert.strictEqual(result.success, true);
  assert.ok(result.data);
  assert.strictEqual(result.data.title, '早起锻炼');
  assert.strictEqual(result.data.time, '08:00');
  assert.strictEqual(result.data.repeat, 'hourly');
  assert.strictEqual(result.data.isCompleted, false);

  // 验证 Storage 持久化包含默认规则
  const item = await storage.getById(result.data.id);
  assert.ok(item);
  assert.strictEqual(item?.time, '08:00');
  assert.strictEqual(item?.repeat, 'hourly');
});

test('URL Scheme 监听流程: 异常与非法输入容错', async () => {
  const storage = createMemoryStorage();
  const notifications = new NotificationEngine();

  // 1. 空 URL
  const emptyRes = await handleIncomingUrl('', storage, notifications);
  assert.strictEqual(emptyRes.success, false);

  // 2. 非法协议
  const invalidProto = await handleIncomingUrl('myapp://create?title=abc', storage, notifications);
  assert.strictEqual(invalidProto.success, false);
  assert.ok(invalidProto.message.includes('无法识别'));

  // 3. 空标题
  const noTitle = await handleIncomingUrl('agentreminder://create?title=', storage, notifications);
  assert.strictEqual(noTitle.success, false);
  assert.ok(noTitle.message.includes('必须提供 title'));

  // 4. 不存在的 ID 删除
  const notFoundDelete = await handleIncomingUrl('agentreminder://delete?id=non_existent', storage, notifications);
  assert.strictEqual(notFoundDelete.success, false);

  // 验证 storage 未被污染
  const all = await storage.getAll();
  assert.strictEqual(all.length, 0);
});

test('前台数据同步与 Storage 监听: 外部修改时组件订阅与 AppState 刷新机制', async () => {
  const storage = createMemoryStorage();
  const notifications = new NotificationEngine();

  let uiSyncCount = 0;
  let currentReminders: ReminderItem[] = [];

  // 模拟页面挂载时的初始加载与订阅
  const loadReminders = async () => {
    currentReminders = await storage.getAll();
    uiSyncCount += 1;
  };

  await loadReminders();
  assert.strictEqual(currentReminders.length, 0);
  assert.strictEqual(uiSyncCount, 1);

  // 订阅 storage 变更
  const unsubscribe = storage.subscribe(() => {
    loadReminders();
  });

  // 模拟外部 Agent 通过 URL Scheme 创建提醒
  await handleIncomingUrl('agentreminder://create?title=外部Agent任务', storage, notifications);

  // 验证通过订阅机制 UI 已自动拉取最新数据
  assert.strictEqual(currentReminders.length, 1);
  assert.strictEqual(currentReminders[0].title, '外部Agent任务');
  assert.strictEqual(uiSyncCount, 2);

  // 模拟 AppState 'active' 事件触发 reload
  const simulateAppStateChange = async (state: string) => {
    if (state === 'active') {
      await loadReminders();
    }
  };

  // 在后台直接通过 storage 写入（模拟原生 Bridge 写数据）
  await storage.save(applyReminderDefaults({ title: '原生Bridge后台写入', date: '2026-09-05' }));

  // 模拟应用从后台切换到前台
  await simulateAppStateChange('active');
  assert.strictEqual(currentReminders.length, 2);
  assert.strictEqual(uiSyncCount, 4); // 1 initial + 1 storage sub + 1 storage sub on save + 1 appState active

  // 取消订阅
  unsubscribe();
});
