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

test('FileSystemBackend: 模拟 Expo SDK 57 File and Paths API 读写与删除', async () => {
  const fileStore = new Map<string, string>();

  class MockFile {
    private uri: string;
    constructor(container: any, name: string) {
      this.uri = `${container.uri}/${name}`;
    }
    get exists(): boolean {
      return fileStore.has(this.uri);
    }
    async text(): Promise<string> {
      return fileStore.get(this.uri) || '';
    }
    write(content: string): void {
      fileStore.set(this.uri, content);
    }
    delete(): void {
      fileStore.delete(this.uri);
    }
  }

  const mockPaths = {
    document: { uri: 'file:///data/document' },
    appleSharedContainers: {
      'group.com.anonymous.myapp': { uri: 'file:///data/group.com.anonymous.myapp' },
    },
  };

  const mockFileSystem = {
    Paths: mockPaths,
    File: MockFile,
  };

  const { FileSystemBackend } = await import('../src/services/storage.ts');
  const backend = new FileSystemBackend(mockFileSystem);

  assert.strictEqual(await backend.getItem('key'), null);

  await backend.setItem('key', JSON.stringify([{ id: '1', title: '测试' }]));
  const content = await backend.getItem('key');
  assert.ok(content);
  assert.strictEqual(JSON.parse(content!)[0].title, '测试');

  await backend.removeItem('key');
  assert.strictEqual(await backend.getItem('key'), null);
});

