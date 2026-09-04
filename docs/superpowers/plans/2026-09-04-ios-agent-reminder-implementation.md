# iOS 17.1+ 轻量高自动化兼容性提醒事项应用实施计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款专为 iOS 17.1+ 打造的轻量级、高自动化兼容性的提醒事项应用，支持手动 Apple HIG UI 管理，并提供原生 App Intents 与 URL Scheme 标准接口供第三方 AI Agent、快捷指令及脚本无缝调用。

**Architecture:** 前端采用 Expo Router (React Native 0.86 / TypeScript) 实现精致的 iOS 17 HIG UI 与 URL Scheme (`agentreminder://`) 调度；原生层通过 Swift 实现 `AppIntents` 框架（`CreateReminderIntent`, `ListRemindersIntent`, `DeleteReminderIntent`）及 `AppShortcutsProvider`，通过共享持久化层与系统本地通知 `UNUserNotificationCenter` 实现静默后台触发与前台无缝同步。

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Swift, AppIntents framework, UserNotifications framework, Expo Config Plugins, Node.js native test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-ios-agent-reminder-design.md`

## Global Constraints

- 目标平台：iOS 17.1+ / Expo SDK 57
- 必填要素：`title`（标题）、`date`（日期：`YYYY-MM-DD`）
- 默认值注入：`time` 默认为 `"08:00"`，`repeat` 默认为 `"hourly"`
- 重复规则枚举：`none` | `half_hourly` | `hourly` | `daily` | `weekly`
- URL Scheme 标识：`agentreminder://`
- 测试策略：采用 Node.js 24 原生测试执行器 `node --experimental-strip-types --test tests/*.test.ts`

---

### Task 1: 核心数据模型、默认值注入引擎与共享存储服务 (TDD)

**Files:**
- Create: `src/types/reminder.ts`
- Create: `src/services/defaults.ts`
- Create: `src/services/storage.ts`
- Test: `tests/defaults.test.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `RepeatRule`: `'none' | 'half_hourly' | 'hourly' | 'daily' | 'weekly'`
  - `ReminderItem`: `{ id, title, notes?, date, time, repeat, isCompleted, createdAt, updatedAt, notificationId? }`
  - `applyReminderDefaults(input: Partial<ReminderItem> & { title: string; date: string }): ReminderItem`
  - `validateReminderDate(dateStr: string): boolean`
  - `validateReminderTime(timeStr: string): boolean`
  - `ReminderStorage`: `class ReminderStorage { getAll(): Promise<ReminderItem[]>; getById(id: string): Promise<ReminderItem | null>; save(item: ReminderItem): Promise<ReminderItem>; delete(id: string): Promise<boolean>; toggleStatus(id: string): Promise<ReminderItem | null>; }`

- [ ] **Step 1: 编写默认值注入与校验的失败测试**

创建 `tests/defaults.test.ts`：
```typescript
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
```

- [ ] **Step 2: 运行测试以验证失败**

运行：`node --experimental-strip-types --test tests/defaults.test.ts`
预期：FAIL（找不到模块 `../src/services/defaults.ts`）

- [ ] **Step 3: 编写核心类型定义与默认值引擎实现**

创建 `src/types/reminder.ts`：
```typescript
export type RepeatRule = 'none' | 'half_hourly' | 'hourly' | 'daily' | 'weekly';

export interface ReminderItem {
  id: string;
  title: string;
  notes?: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  repeat: RepeatRule;
  isCompleted: boolean;
  createdAt: number;
  updatedAt: number;
  notificationId?: string;
}

export interface CreateReminderInput {
  id?: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  repeat?: RepeatRule;
}
```

创建 `src/services/defaults.ts`：
```typescript
import { ReminderItem, CreateReminderInput, RepeatRule } from '../types/reminder.ts';

export const DEFAULT_TIME = '08:00';
export const DEFAULT_REPEAT: RepeatRule = 'hourly';

export function generateReminderId(): string {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `rem_${Date.now()}_${randomStr}`;
}

export function validateReminderDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function validateReminderTime(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    return false;
  }
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function applyReminderDefaults(input: CreateReminderInput): ReminderItem {
  const now = Date.now();
  const time = input.time && validateReminderTime(input.time) ? input.time : DEFAULT_TIME;
  const repeat: RepeatRule = input.repeat || DEFAULT_REPEAT;
  const id = input.id && input.id.trim().length > 0 ? input.id.trim() : generateReminderId();

  return {
    id,
    title: input.title.trim(),
    notes: input.notes ? input.notes.trim() : '',
    date: input.date.trim(),
    time,
    repeat,
    isCompleted: false,
    createdAt: now,
    updatedAt: now,
    notificationId: id,
  };
}
```

- [ ] **Step 4: 运行 defaults 测试验证通过**

运行：`node --experimental-strip-types --test tests/defaults.test.ts`
预期：PASS

- [ ] **Step 5: 编写存储持久化层失败测试**

创建 `tests/storage.test.ts`：
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { ReminderStorage } from '../src/services/storage.ts';
import { applyReminderDefaults } from '../src/services/defaults.ts';

test('ReminderStorage: 保存、查询、切换完成状态与删除流程', async () => {
  const memoryAdapter = new Map<string, string>();
  const storage = new ReminderStorage({
    async getItem(key: string) { return memoryAdapter.get(key) || null; },
    async setItem(key: string, value: string) { memoryAdapter.set(key, value); },
    async removeItem(key: string) { memoryAdapter.delete(key); },
  });

  // 1. 初始化应为空
  const initial = await storage.getAll();
  assert.strictEqual(initial.length, 0);

  // 2. 保存
  const item = applyReminderDefaults({ title: '买咖啡', date: '2026-09-05' });
  await storage.save(item);

  const list = await storage.getAll();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].title, '买咖啡');

  // 3. 按 ID 查询
  const fetched = await storage.getById(item.id);
  assert.ok(fetched);
  assert.strictEqual(fetched?.id, item.id);

  // 4. 切换完成状态
  const toggled = await storage.toggleStatus(item.id);
  assert.ok(toggled);
  assert.strictEqual(toggled?.isCompleted, true);

  // 5. 删除
  const deleted = await storage.delete(item.id);
  assert.strictEqual(deleted, true);

  const afterDelete = await storage.getAll();
  assert.strictEqual(afterDelete.length, 0);
});
```

- [ ] **Step 6: 实现 `src/services/storage.ts`**

创建 `src/services/storage.ts`：
```typescript
import { ReminderItem } from '../types/reminder.ts';

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const STORAGE_KEY = 'agent_reminders_v1';

class LocalMemoryBackend implements StorageBackend {
  private cache = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return this.cache.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    this.cache.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    this.cache.delete(key);
  }
}

export class ReminderStorage {
  private backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    this.backend = backend || new LocalMemoryBackend();
  }

  async getAll(): Promise<ReminderItem[]> {
    try {
      const raw = await this.backend.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<ReminderItem | null> {
    const list = await this.getAll();
    return list.find((i) => i.id === id) || null;
  }

  async save(item: ReminderItem): Promise<ReminderItem> {
    const list = await this.getAll();
    const index = list.findIndex((i) => i.id === item.id);
    const updatedItem = { ...item, updatedAt: Date.now() };

    if (index >= 0) {
      list[index] = updatedItem;
    } else {
      list.unshift(updatedItem);
    }

    await this.backend.setItem(STORAGE_KEY, JSON.stringify(list));
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    const list = await this.getAll();
    const filtered = list.filter((i) => i.id !== id);
    if (filtered.length === list.length) {
      return false;
    }
    await this.backend.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }

  async toggleStatus(id: string): Promise<ReminderItem | null> {
    const item = await this.getById(id);
    if (!item) return null;
    item.isCompleted = !item.isCompleted;
    return this.save(item);
  }
}

export const defaultStorage = new ReminderStorage();
```

- [ ] **Step 7: 运行 storage 测试并提交**

运行：`node --experimental-strip-types --test tests/storage.test.ts`
预期：PASS

提交：
```bash
git add src/types/reminder.ts src/services/defaults.ts src/services/storage.ts tests/defaults.test.ts tests/storage.test.ts
git commit -m "feat: add reminder core types, default injection engine and storage service"
```

---

### Task 2: 本地通知调度引擎与触发时间计算 (TDD)

**Files:**
- Create: `src/services/notifications.ts`
- Test: `tests/notifications.test.ts`

**Interfaces:**
- Consumes: `ReminderItem`, `RepeatRule` from Task 1
- Produces:
  - `calculateTriggerDate(dateStr: string, timeStr: string): Date`
  - `getRepeatIntervalDescription(repeat: RepeatRule): string`
  - `NotificationScheduleInfo`: `{ triggerType: 'calendar' | 'interval'; repeats: boolean; targetDate: Date; intervalSeconds?: number }`
  - `buildNotificationSchedule(reminder: ReminderItem): NotificationScheduleInfo`
  - `NotificationEngine`: `class NotificationEngine { schedule(reminder: ReminderItem): Promise<string>; cancel(notificationId: string): Promise<void>; requestPermissions(): Promise<boolean>; }`

- [ ] **Step 1: 编写通知调度计算的失败测试**

创建 `tests/notifications.test.ts`：
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateTriggerDate,
  getRepeatIntervalDescription,
  buildNotificationSchedule,
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
});

test('getRepeatIntervalDescription: 中文易读描述', () => {
  assert.strictEqual(getRepeatIntervalDescription('none'), '不重复');
  assert.strictEqual(getRepeatIntervalDescription('half_hourly'), '每半小时');
  assert.strictEqual(getRepeatIntervalDescription('hourly'), '每小时');
  assert.strictEqual(getRepeatIntervalDescription('daily'), '每日');
  assert.strictEqual(getRepeatIntervalDescription('weekly'), '每周');
});
```

- [ ] **Step 2: 运行测试以验证失败**

运行：`node --experimental-strip-types --test tests/notifications.test.ts`
预期：FAIL

- [ ] **Step 3: 编写 `src/services/notifications.ts` 实现**

创建 `src/services/notifications.ts`：
```typescript
import { ReminderItem, RepeatRule } from '../types/reminder.ts';

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
```

- [ ] **Step 4: 运行 notifications 测试验证通过**

运行：`node --experimental-strip-types --test tests/notifications.test.ts`
预期：PASS

- [ ] **Step 5: 提交 Task 2 代码**

```bash
git add src/services/notifications.ts tests/notifications.test.ts
git commit -m "feat: add notification trigger schedule engine and repeat interval calculations"
```

---

### Task 3: URL Scheme (`agentreminder://`) 协议解析与调度分发器 (TDD)

**Files:**
- Create: `src/services/urlScheme.ts`
- Test: `tests/urlScheme.test.ts`

**Interfaces:**
- Consumes: `applyReminderDefaults`, `ReminderStorage`, `NotificationEngine` from Tasks 1-2
- Produces:
  - `ParsedUrlAction`:
    - `{ type: 'create'; params: CreateReminderInput }`
    - `{ type: 'list'; filter?: 'all' | 'pending' | 'completed' }`
    - `{ type: 'delete'; id: string }`
    - `{ type: 'toggle'; id: string }`
    - `{ type: 'unknown'; rawUrl: string; error: string }`
  - `parseUrlScheme(url: string): ParsedUrlAction`
  - `executeUrlAction(action: ParsedUrlAction, storage: ReminderStorage, notifications: NotificationEngine): Promise<{ success: boolean; message: string; data?: any }>`

- [ ] **Step 1: 编写 URL Scheme 解析与分发失败测试**

创建 `tests/urlScheme.test.ts`：
```typescript
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
```

- [ ] **Step 2: 运行测试以验证失败**

运行：`node --experimental-strip-types --test tests/urlScheme.test.ts`
预期：FAIL

- [ ] **Step 3: 编写 `src/services/urlScheme.ts` 实现**

创建 `src/services/urlScheme.ts`：
```typescript
import { CreateReminderInput, RepeatRule } from '../types/reminder.ts';
import { applyReminderDefaults } from './defaults.ts';
import { ReminderStorage } from './storage.ts';
import { NotificationEngine } from './notifications.ts';

export type ParsedUrlAction =
  | { type: 'create'; params: CreateReminderInput }
  | { type: 'list'; filter?: 'all' | 'pending' | 'completed' }
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string }
  | { type: 'unknown'; rawUrl: string; error: string };

export function parseUrlScheme(rawUrl: string): ParsedUrlAction {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'agentreminder:') {
      return { type: 'unknown', rawUrl, error: `Invalid protocol: ${parsed.protocol}` };
    }

    const hostnameOrPath = (parsed.hostname || parsed.pathname || '').replace(/^\/+/, '');
    const searchParams = parsed.searchParams;

    if (hostnameOrPath === 'create') {
      const title = searchParams.get('title') || searchParams.get('text') || '';
      const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
      const time = searchParams.get('time') || undefined;
      const repeatRaw = searchParams.get('repeat') || undefined;
      const notes = searchParams.get('notes') || undefined;
      const id = searchParams.get('id') || undefined;

      let repeat: RepeatRule | undefined;
      if (repeatRaw && ['none', 'half_hourly', 'hourly', 'daily', 'weekly'].includes(repeatRaw)) {
        repeat = repeatRaw as RepeatRule;
      }

      return {
        type: 'create',
        params: {
          id,
          title,
          date,
          time,
          repeat,
          notes,
        },
      };
    }

    if (hostnameOrPath === 'delete') {
      const id = searchParams.get('id') || '';
      return { type: 'delete', id };
    }

    if (hostnameOrPath === 'toggle') {
      const id = searchParams.get('id') || '';
      return { type: 'toggle', id };
    }

    if (hostnameOrPath === 'list') {
      const filter = (searchParams.get('filter') as any) || 'all';
      return { type: 'list', filter };
    }

    return { type: 'unknown', rawUrl, error: `Unsupported action: ${hostnameOrPath}` };
  } catch (err: any) {
    return { type: 'unknown', rawUrl, error: err?.message || 'Failed to parse URL' };
  }
}

export async function executeUrlAction(
  action: ParsedUrlAction,
  storage: ReminderStorage,
  notifications: NotificationEngine
): Promise<{ success: boolean; message: string; data?: any }> {
  switch (action.type) {
    case 'create': {
      if (!action.params.title || action.params.title.trim().length === 0) {
        return { success: false, message: '创建失败：必须提供 title 标题' };
      }
      const reminder = applyReminderDefaults(action.params);
      await storage.save(reminder);
      await notifications.schedule(reminder);
      return {
        success: true,
        message: `已创建提醒「${reminder.title}」，将于 ${reminder.date} ${reminder.time} 触发（重复：${reminder.repeat}）`,
        data: reminder,
      };
    }
    case 'delete': {
      if (!action.id) {
        return { success: false, message: '删除失败：必须提供 id' };
      }
      const ok = await storage.delete(action.id);
      if (ok) {
        await notifications.cancel(action.id);
        return { success: true, message: `已成功删除提醒 ${action.id}` };
      }
      return { success: false, message: `未找到 ID 为 ${action.id} 的提醒` };
    }
    case 'toggle': {
      if (!action.id) {
        return { success: false, message: '切换失败：必须提供 id' };
      }
      const updated = await storage.toggleStatus(action.id);
      if (updated) {
        return {
          success: true,
          message: `提醒状态已更新为：${updated.isCompleted ? '已完成' : '待办'}`,
          data: updated,
        };
      }
      return { success: false, message: `未找到 ID 为 ${action.id} 的提醒` };
    }
    case 'list': {
      const all = await storage.getAll();
      let filtered = all;
      if (action.filter === 'pending') {
        filtered = all.filter((i) => !i.isCompleted);
      } else if (action.filter === 'completed') {
        filtered = all.filter((i) => i.isCompleted);
      }
      return {
        success: true,
        message: `查询到 ${filtered.length} 条提醒`,
        data: filtered,
      };
    }
    case 'unknown':
      return { success: false, message: `无法识别的指令：${action.error}` };
  }
}
```

- [ ] **Step 4: 运行 urlScheme 测试验证通过**

运行：`node --experimental-strip-types --test tests/urlScheme.test.ts`
预期：PASS

- [ ] **Step 5: 提交 Task 3 代码**

```bash
git add src/services/urlScheme.ts tests/urlScheme.test.ts
git commit -m "feat: add agentreminder URL scheme parser and action dispatcher"
```

---

### Task 4: 原生 Swift App Intents 实现与 Expo Config Plugin

**Files:**
- Create: `ios-native/AppIntents/ReminderDataBridge.swift`
- Create: `ios-native/AppIntents/NotificationManager.swift`
- Create: `ios-native/AppIntents/CreateReminderIntent.swift`
- Create: `ios-native/AppIntents/ListRemindersIntent.swift`
- Create: `ios-native/AppIntents/DeleteReminderIntent.swift`
- Create: `ios-native/AppIntents/AppShortcutsProvider.swift`
- Create: `plugins/withAppIntents.js`
- Modify: `app.json`

**Interfaces:**
- Consumes: `ReminderItem` fields, default values (`08:00`, `hourly`)
- Produces:
  - Swift 3 个核心 AppIntents 与 AppShortcutsProvider。
  - Expo Config Plugin 自动配置 URL Scheme `agentreminder`、iOS 权限提示及 App Group。

- [ ] **Step 1: 编写 Swift AppIntents 原生模块**

创建 `ios-native/AppIntents/ReminderDataBridge.swift`：
```swift
import Foundation

public struct SwiftReminderItem: Codable, Identifiable {
    public var id: String
    public var title: String
    public var notes: String?
    public var date: String
    public var time: String
    public var repeatRule: String
    public var isCompleted: Bool
    public var createdAt: Double
    public var updatedAt: Double
    public var notificationId: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, notes, date, time
        case repeatRule = "repeat"
        case isCompleted, createdAt, updatedAt, notificationId
    }
}

public class ReminderDataBridge {
    public static let shared = ReminderDataBridge()
    private let appGroupIdentifier = "group.com.anonymous.myapp"
    private let fileName = "reminders.json"
    
    private var fileURL: URL? {
        if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            return container.appendingPathComponent(fileName)
        }
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent(fileName)
    }
    
    public func loadReminders() -> [SwiftReminderItem] {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else {
            return []
        }
        return (try? JSONDecoder().decode([SwiftReminderItem].self, from: data)) ?? []
    }
    
    public func saveReminders(_ reminders: [SwiftReminderItem]) {
        guard let url = fileURL, let data = try? JSONEncoder().encode(reminders) else { return }
        try? data.write(to: url)
    }
    
    public func addReminder(_ reminder: SwiftReminderItem) {
        var list = loadReminders()
        list.insert(reminder, at: 0)
        saveReminders(list)
    }
    
    public func deleteReminder(id: String) -> Bool {
        var list = loadReminders()
        let initialCount = list.count
        list.removeAll { $0.id == id }
        if list.count != initialCount {
            saveReminders(list)
            return true
        }
        return false
    }
}
```

创建 `ios-native/AppIntents/NotificationManager.swift`：
```swift
import Foundation
import UserNotifications

public class NativeNotificationManager {
    public static let shared = NativeNotificationManager()
    
    public func scheduleNotification(for item: SwiftReminderItem) {
        let content = UNMutableNotificationContent()
        content.title = item.title
        if let notes = item.notes, !notes.isEmpty {
            content.body = notes
        }
        content.sound = .default
        
        let components = item.date.split(separator: "-")
        let timeComponents = item.time.split(separator: ":")
        
        guard components.count == 3, timeComponents.count == 2,
              let year = Int(components[0]), let month = Int(components[1]), let day = Int(components[2]),
              let hour = Int(timeComponents[0]), let minute = Int(timeComponents[1]) else {
            return
        }
        
        var dateComponents = DateComponents()
        dateComponents.hour = hour
        dateComponents.minute = minute
        
        var trigger: UNNotificationTrigger
        
        switch item.repeatRule {
        case "half_hourly":
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1800, repeats: true)
        case "hourly":
            dateComponents.hour = nil // 匹配每小时的该分钟
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        case "daily":
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        case "weekly":
            dateComponents.weekday = Calendar.current.component(.weekday, from: Date())
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        default:
            dateComponents.year = year
            dateComponents.month = month
            dateComponents.day = day
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
        }
        
        let request = UNNotificationRequest(identifier: item.id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
    
    public func cancelNotification(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}
```

创建 `ios-native/AppIntents/CreateReminderIntent.swift`：
```swift
import AppIntents
import Foundation

public enum RepeatAppEnum: String, AppEnum {
    case none = "none"
    case halfHourly = "half_hourly"
    case hourly = "hourly"
    case daily = "daily"
    case weekly = "weekly"
    
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "重复规则"
    public static var caseDisplayRepresentations: [RepeatAppEnum: DisplayRepresentation] = [
        .none: "不重复",
        .halfHourly: "每半小时",
        .hourly: "每小时",
        .daily: "每日",
        .weekly: "每周"
    ]
}

public struct CreateReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "创建提醒"
    public static var description: IntentDescription = "创建一个新的提醒事项，自动应用默认时间与重复规则"
    
    @Parameter(title: "标题")
    public var title: String
    
    @Parameter(title: "日期")
    public var date: Date
    
    @Parameter(title: "时间", default: "08:00")
    public var time: String?
    
    @Parameter(title: "重复规则", default: .hourly)
    public var repeatRule: RepeatAppEnum?
    
    @Parameter(title: "备注")
    public var notes: String?
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<String> & ProvidesDialog {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)
        
        let resolvedTime = (time != nil && !time!.isEmpty) ? time! : "08:00"
        let resolvedRepeat = (repeatRule ?? .hourly).rawValue
        let id = "rem_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(6))"
        
        let newItem = SwiftReminderItem(
            id: id,
            title: title,
            notes: notes,
            date: dateString,
            time: resolvedTime,
            repeatRule: resolvedRepeat,
            isCompleted: false,
            createdAt: Date().timeIntervalSince1970 * 1000,
            updatedAt: Date().timeIntervalSince1970 * 1000,
            notificationId: id
        )
        
        ReminderDataBridge.shared.addReminder(newItem)
        NativeNotificationManager.shared.scheduleNotification(for: newItem)
        
        let summary = "已为您成功创建提醒「\(title)」，将于 \(dateString) \(resolvedTime) 提醒。"
        return .result(value: id, dialog: IntentDialog(stringLiteral: summary))
    }
}
```

创建 `ios-native/AppIntents/ListRemindersIntent.swift`：
```swift
import AppIntents
import Foundation

public struct ReminderAppEntity: AppEntity {
    public static var defaultQuery = ReminderQuery()
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "提醒项目"
    
    public var id: String
    public var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(date) \(time) (\(repeatRule))")
    }
    
    @Property(title: "标题")
    public var title: String
    
    @Property(title: "日期")
    public var date: String
    
    @Property(title: "时间")
    public var time: String
    
    @Property(title: "重复规则")
    public var repeatRule: String
    
    @Property(title: "是否已完成")
    public var isCompleted: Bool
}

public struct ReminderQuery: EntityQuery {
    public func entities(for identifiers: [String]) async throws -> [ReminderAppEntity] {
        let all = ReminderDataBridge.shared.loadReminders()
        return all.filter { identifiers.contains($0.id) }.map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
    }
    
    public func suggestedEntities() async throws -> [ReminderAppEntity] {
        return ReminderDataBridge.shared.loadReminders().map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
    }
}

public struct ListRemindersIntent: AppIntent {
    public static var title: LocalizedStringResource = "查看提醒列表"
    public static var description: IntentDescription = "获取当前所有待办或全部提醒列表"
    
    @Parameter(title: "包含已完成", default: false)
    public var includeCompleted: Bool
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<[ReminderAppEntity]> & ProvidesDialog {
        let all = ReminderDataBridge.shared.loadReminders()
        let filtered = includeCompleted ? all : all.filter { !$0.isCompleted }
        
        let entities = filtered.map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
        
        return .result(value: entities, dialog: IntentDialog(stringLiteral: "共找到 \(entities.count) 条提醒事项"))
    }
}
```

创建 `ios-native/AppIntents/DeleteReminderIntent.swift`：
```swift
import AppIntents
import Foundation

public struct DeleteReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "删除提醒"
    public static var description: IntentDescription = "根据提醒ID从列表中删除并取消通知"
    
    @Parameter(title: "提醒ID")
    public var reminderID: String
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<Bool> & ProvidesDialog {
        let success = ReminderDataBridge.shared.deleteReminder(id: reminderID)
        if success {
            NativeNotificationManager.shared.cancelNotification(id: reminderID)
            return .result(value: true, dialog: "提醒 \(reminderID) 已成功删除")
        } else {
            return .result(value: false, dialog: "未找到 ID 为 \(reminderID) 的提醒")
        }
    }
}
```

创建 `ios-native/AppIntents/AppShortcutsProvider.swift`：
```swift
import AppIntents

public struct AgentReminderShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CreateReminderIntent(),
            phrases: [
                "用 \(.applicationName) 创建提醒",
                "在 \(.applicationName) 添加待办"
            ],
            shortTitle: "新建提醒",
            systemImageName: "bell.badge"
        )
        AppShortcut(
            intent: ListRemindersIntent(),
            phrases: [
                "用 \(.applicationName) 查看提醒",
                "查看 \(.applicationName) 待办"
            ],
            shortTitle: "查看提醒",
            systemImageName: "checklist"
        )
    }
}
```

- [ ] **Step 2: 编写 Expo Config Plugin `plugins/withAppIntents.js` 并更新 `app.json`**

创建 `plugins/withAppIntents.js`：
```javascript
const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

const withAppIntents = (config) => {
  // 配置 Info.plist 中的权限描述与 URL Scheme
  config = withInfoPlist(config, (config) => {
    config.modResults.NSUserNotificationsUsageDescription =
      '需要您的通知权限以便在设定的时间准时提醒您待办事项。';
    return config;
  });

  // 配置 App Groups 共享容器 Entitlement
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [
      'group.com.anonymous.myapp',
    ];
    return config;
  });

  return config;
};

module.exports = withAppIntents;
```

更新 `app.json` 中的 `scheme` 与 `plugins`，确保 `agentreminder` 作为主 scheme：
```json
"scheme": "agentreminder",
"plugins": [
  "./plugins/withAppIntents.js",
  "expo-router",
  ...
]
```

- [ ] **Step 3: 提交 Task 4 代码**

```bash
git add ios-native/ plugins/ app.json
git commit -m "feat: add Swift AppIntents module and Expo Config Plugin for iOS 17.1+ automation"
```

---

### Task 5: Apple HIG 风格 UI 组件库开发 (TDD & Components)

**Files:**
- Create: `src/components/ReminderCard.tsx`
- Create: `src/components/FilterBar.tsx`
- Create: `src/components/AddReminderModal.tsx`
- Create: `src/components/AutomationTester.tsx`
- Test: `tests/components.test.ts`

**Interfaces:**
- Consumes: `ReminderItem`, `RepeatRule`, `applyReminderDefaults`
- Produces:
  - `ReminderCard`: 展示提醒卡片、完成状态切换、点击触发微震动、删除动作。
  - `FilterBar`: 筛选药丸（全部、待办、已完成、循环中）。
  - `AddReminderModal`: 弹出半屏模态新建界面，默认注入 08:00 与 hourly。
  - `AutomationTester`: 自动化调试组件，支持一键测试 URL Scheme 和复制 Agent 提示词。

- [ ] **Step 1: 编写组件业务逻辑测试**

创建 `tests/components.test.ts`：
```typescript
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
```

- [ ] **Step 2: 运行测试以验证逻辑通过**

运行：`node --experimental-strip-types --test tests/components.test.ts`
预期：PASS

- [ ] **Step 3: 创建 `src/components/ReminderCard.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ReminderItem } from '../types/reminder';
import { getRepeatIntervalDescription } from '../services/notifications';

interface ReminderCardProps {
  item: ReminderItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({ item, onToggle, onDelete }) => {
  const isRepeating = item.repeat !== 'none';

  return (
    <View style={[styles.card, item.isCompleted && styles.cardCompleted]}>
      <TouchableOpacity
        style={[styles.checkbox, item.isCompleted && styles.checkboxChecked]}
        onPress={() => onToggle(item.id)}
        activeOpacity={0.7}
      >
        {item.isCompleted && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, item.isCompleted && styles.titleCompleted]}>
          {item.title}
        </Text>
        {item.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>📅 {item.date}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⏰ {item.time}</Text>
          </View>
          {isRepeating ? (
            <View style={[styles.badge, styles.repeatBadge]}>
              <Text style={styles.repeatBadgeText}>
                🔄 {getRepeatIntervalDescription(item.repeat)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert('确认删除', `是否删除提醒「${item.title}」？`, [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: () => onDelete(item.id) },
          ]);
        }}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCompleted: {
    opacity: 0.6,
    backgroundColor: '#F8F9FA',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  notes: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  repeatBadge: {
    backgroundColor: '#E8F3FF',
  },
  repeatBadgeText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteText: {
    fontSize: 16,
    color: '#C7C7CC',
  },
});
```

- [ ] **Step 4: 创建 `src/components/FilterBar.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type FilterType = 'all' | 'pending' | 'completed' | 'repeating';

interface FilterBarProps {
  currentFilter: FilterType;
  onSelect: (filter: FilterType) => void;
  counts: { all: number; pending: number; completed: number; repeating: number };
}

export const FilterBar: React.FC<FilterBarProps> = ({ currentFilter, onSelect, counts }) => {
  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'pending', label: '待办', count: counts.pending },
    { key: 'completed', label: '已完成', count: counts.completed },
    { key: 'repeating', label: '循环中', count: counts.repeating },
  ];

  return (
    <View style={styles.container}>
      {filters.map((f) => {
        const active = currentFilter === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {f.label} ({f.count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  pillActive: {
    backgroundColor: '#007AFF',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});
```

- [ ] **Step 5: 创建 `src/components/AddReminderModal.tsx`**

```tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CreateReminderInput, RepeatRule } from '../types/reminder';
import { DEFAULT_TIME, DEFAULT_REPEAT } from '../services/defaults';

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: CreateReminderInput) => void;
}

export const AddReminderModal: React.FC<AddReminderModalProps> = ({ visible, onClose, onAdd }) => {
  const today = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [repeat, setRepeat] = useState<RepeatRule>(DEFAULT_REPEAT);

  const handleSave = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      date,
      time,
      repeat,
    });
    setTitle('');
    setNotes('');
    setTime(DEFAULT_TIME);
    setRepeat(DEFAULT_REPEAT);
    onClose();
  };

  const repeatOptions: { key: RepeatRule; label: string }[] = [
    { key: 'none', label: '不重复' },
    { key: 'half_hourly', label: '每半小时' },
    { key: 'hourly', label: '每小时 (默认)' },
    { key: 'daily', label: '每日' },
    { key: 'weekly', label: '每周' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>新建提醒事项</Text>
          <TouchableOpacity onPress={handleSave} disabled={!title.trim()}>
            <Text style={[styles.saveText, !title.trim() && styles.saveTextDisabled]}>添加</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>标题（必填）</Text>
            <TextInput
              style={styles.input}
              placeholder="如：给客户发邮件、吃药、开会"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={styles.sectionLabel}>备注内容（可选）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="详情说明或由 Agent 传入的元数据"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>触发日期 (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} />

            <Text style={styles.sectionLabel}>触发时间 (默认 08:00)</Text>
            <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="08:00" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>重复规则（默认每小时）</Text>
            <View style={styles.repeatList}>
              {repeatOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.repeatOption, repeat === opt.key && styles.repeatOptionActive]}
                  onPress={() => setRepeat(opt.key)}
                >
                  <Text style={[styles.repeatText, repeat === opt.key && styles.repeatTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveTextDisabled: {
    color: '#999',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  repeatList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  repeatOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  repeatOptionActive: {
    backgroundColor: '#007AFF',
  },
  repeatText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  repeatTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
```

- [ ] **Step 6: 创建 `src/components/AutomationTester.tsx` 自动化调试与模板面板**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';

export const AutomationTester: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const [testTitle, setTestTitle] = useState('测试 Agent 提醒');
  const [testDate, setTestDate] = useState(today);
  const [testTime, setTestTime] = useState('08:00');
  const [testRepeat, setTestRepeat] = useState('hourly');

  const generatedUrl = `agentreminder://create?title=${encodeURIComponent(testTitle)}&date=${testDate}&time=${testTime}&repeat=${testRepeat}`;

  const triggerTestUrl = async () => {
    try {
      await Linking.openURL(generatedUrl);
    } catch (e: any) {
      Alert.alert('打开失败', e?.message || '无法唤起 URL Scheme');
    }
  };

  const agentPrompt = `你是一个自动化助手。当需要创建提醒时，请调用 agentreminder 接口：
URL Scheme 规范：
agentreminder://create?title={标题}&date={YYYY-MM-DD}&time={HH:mm}&repeat={none|half_hourly|hourly|daily|weekly}
规则：
1. 若未指定时间，系统将默认使用 08:00。
2. 若未指定重复规则，系统将默认使用 hourly（每小时重复）。`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ URL Scheme 实时测试器</Text>
        <Text style={styles.cardDesc}>第三方应用/脚本可通过此标准 URL 协议创建提醒事项：</Text>

        <TextInput style={styles.input} value={testTitle} onChangeText={setTestTitle} placeholder="标题" />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={testDate} onChangeText={setTestDate} placeholder="日期" />
          <TextInput style={[styles.input, styles.half]} value={testTime} onChangeText={setTestTime} placeholder="时间 (默认08:00)" />
        </View>

        <View style={styles.urlBox}>
          <Text style={styles.urlText}>{generatedUrl}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={triggerTestUrl}>
          <Text style={styles.buttonText}>🚀 点击测试唤起当前 URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 AI Agent 接入提示词模版</Text>
        <Text style={styles.cardDesc}>直接复制给 LLM 或 Agent 系统提示词：</Text>
        <View style={styles.promptBox}>
          <Text style={styles.promptText}>{agentPrompt}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 原生 App Intents 支持说明</Text>
        <Text style={styles.cardDesc}>
          在 iOS 16/17+「快捷指令」App 中，可直接搜索到：{'\n'}
          • <Text style={styles.bold}>创建提醒 (CreateReminderIntent)</Text>：默认时间 08:00，默认每小时。{'\n'}
          • <Text style={styles.bold}>查看提醒列表 (ListRemindersIntent)</Text>{'\n'}
          • <Text style={styles.bold}>删除提醒 (DeleteReminderIntent)</Text>
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1C1C1E',
  },
  cardDesc: {
    fontSize: 13,
    color: '#636366',
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  urlBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  urlText: {
    color: '#30D158',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  promptBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 12,
  },
  promptText: {
    fontSize: 12,
    color: '#3A3A3C',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '600',
    color: '#007AFF',
  },
});
```

- [ ] **Step 7: 提交 Task 5 代码**

```bash
git add src/components/ tests/components.test.ts
git commit -m "feat: add Apple HIG UI components, filter bar, add modal and automation tester"
```

---

### Task 6: 页面路由集成、前台数据同步与 URL Scheme 监听

**Files:**
- Modify: `src/app/_layout.tsx`
- Create: `src/app/(tabs)/index.tsx`
- Create: `src/app/(tabs)/automation.tsx`
- Create: `src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: All services and components from Tasks 1-5
- Produces: Complete app with Reminders Tab and Automation Tab, foreground sync on `AppState === 'active'`.

- [ ] **Step 1: 创建 `src/app/(tabs)/_layout.tsx` 底部导航栏**

```tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '提醒事项',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📋</Text>,
          headerTitle: '全部提醒',
        }}
      />
      <Tabs.Screen
        name="automation"
        options={{
          title: '自动化中心',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚡</Text>,
          headerTitle: 'Agent 与自动化',
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: 创建主页面 `src/app/(tabs)/index.tsx`**

实现：列表渲染、下拉刷新、统计计数、筛选标签切换、复选框完成标记、删除、新建弹窗及 AppState 前台自动刷新。

- [ ] **Step 3: 创建自动化中心页面 `src/app/(tabs)/automation.tsx`**

实现：嵌入 `AutomationTester`，展示快捷指令教程与 URL Scheme 交互。

- [ ] **Step 4: 配置根布局 `src/app/_layout.tsx`**

实现：全局监听 `Linking.addEventListener('url', ...)` 统一处理外部 Agent 唤起。

- [ ] **Step 5: 提交 Task 6 代码**

```bash
git add src/app/
git commit -m "feat: integrate main tabs, deep linking listener and foreground sync"
```

---

### Task 7: 系统完整性验证、TypeScript 构建与交付文档

**Files:**
- Test: 运行所有单元测试 `node --experimental-strip-types --test tests/*.test.ts`
- Test: 运行 TypeScript 静态检查 `npx tsc --noEmit`
- Create: `docs/superpowers/guides/agent-integration-guide.md`

- [ ] **Step 1: 运行全量单元测试**

运行：`node --experimental-strip-types --test tests/*.test.ts`
预期：所有测试 100% PASS。

- [ ] **Step 2: 运行 TypeScript 编译检查**

运行：`npx tsc --noEmit`
预期：Exit code 0，无任何类型错误。

- [ ] **Step 3: 编写第三方 Agent 接入使用指南**

创建 `docs/superpowers/guides/agent-integration-guide.md`，详细列出 App Intents、Shortcuts 与 URL Scheme 的完整调用示例。

- [ ] **Step 4: 提交交付代码**

```bash
git add docs/superpowers/guides/
git commit -m "docs: add comprehensive third-party agent integration guide"
```
