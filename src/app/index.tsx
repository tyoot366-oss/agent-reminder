import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  AppState,
  Alert,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReminderCard } from '@/components/ReminderCard';
import { FilterBar } from '@/components/FilterBar';
import { AddReminderModal } from '@/components/AddReminderModal';
import { defaultStorage } from '@/services/storage';
import { defaultNotificationEngine } from '@/services/notifications';
import {
  applyReminderDefaults,
  filterReminders,
  computeFilterCounts,
} from '@/services/defaults';
import type { ReminderItem, CreateReminderInput, FilterType } from '@/types/reminder';

function getTodayDisplayString(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  };
  try {
    return now.toLocaleDateString('zh-CN', options);
  } catch {
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }
}

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  // 1. 从 Storage 全量加载提醒数据
  const loadReminders = useCallback(async () => {
    try {
      const items = await defaultStorage.getAll();
      setReminders(items);
    } catch (err) {
      console.error('Failed to load reminders from storage:', err);
    }
  }, []);

  // 2. 初始化加载 + AppState 前台唤醒监听 + Storage 订阅同步
  useEffect(() => {
    loadReminders();

    // 监听应用前台唤醒 (例如外部 Agent 触发 URL Scheme 后切回前台)
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadReminders();
      }
    });

    // 订阅存储内部变更事件
    const unsubscribeStorage = defaultStorage.subscribe(() => {
      loadReminders();
    });

    return () => {
      appStateSub.remove();
      unsubscribeStorage();
    };
  }, [loadReminders]);

  // 3. 下拉刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadReminders();
    setIsRefreshing(false);
  }, [loadReminders]);

  // 4. 切换状态 (完成 / 待办) 并同步本地通知引擎
  const handleToggle = useCallback(
    async (id: string) => {
      try {
        const updated = await defaultStorage.toggleStatus(id);
        if (updated) {
          if (updated.isCompleted) {
            await defaultNotificationEngine.cancel(id);
          } else {
            await defaultNotificationEngine.schedule(updated);
          }
          await loadReminders();
        }
      } catch (err: any) {
        console.error('Failed to toggle reminder status:', err);
        Alert.alert('操作失败', err?.message || '更新提醒状态失败，请重试');
      }
    },
    [loadReminders]
  );

  // 5. 删除提醒并注销通知
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const ok = await defaultStorage.delete(id);
        if (ok) {
          await defaultNotificationEngine.cancel(id);
          await loadReminders();
        }
      } catch (err: any) {
        console.error('Failed to delete reminder:', err);
        Alert.alert('操作失败', err?.message || '删除提醒失败，请重试');
      }
    },
    [loadReminders]
  );

  // 6. 新增提醒
  const handleAdd = useCallback(
    async (input: CreateReminderInput) => {
      try {
        const item = applyReminderDefaults(input);
        await defaultStorage.save(item);
        await defaultNotificationEngine.schedule(item);
        await loadReminders();
      } catch (err: any) {
        console.error('Failed to add reminder:', err);
        Alert.alert('操作失败', err?.message || '创建提醒失败，请重试');
      }
    },
    [loadReminders]
  );

  // 7. 计算分类统计数据与过滤列表
  const counts = useMemo(() => computeFilterCounts(reminders), [reminders]);
  const filteredReminders = useMemo(
    () => filterReminders(reminders, currentFilter),
    [reminders, currentFilter]
  );

  // 空状态展示组件
  const renderEmptyComponent = () => {
    let emptyTitle = '暂无提醒事项';
    let emptySub = '轻触右下角「+」或通过 AI Agent 自动化创建提醒';

    if (currentFilter === 'pending') {
      emptyTitle = '全部待办已搞定';
      emptySub = '休息一下，或者添加新的计划';
    } else if (currentFilter === 'completed') {
      emptyTitle = '暂无已完成提醒';
      emptySub = '完成事项后将归档显示在这里';
    } else if (currentFilter === 'repeating') {
      emptyTitle = '暂无循环提醒';
      emptySub = '可设置每小时、每日、每周的重复任务';
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptySub}>{emptySub}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 顶部标题栏 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>{getTodayDisplayString()}</Text>
          <Text style={styles.headerTitle}>全部提醒</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{counts.pending} 待办</Text>
        </View>
      </View>

      {/* 筛选标签栏 */}
      <View style={styles.filterBarWrapper}>
        <FilterBar currentFilter={currentFilter} onSelect={setCurrentFilter} counts={counts} />
      </View>

      {/* 提醒事项列表 */}
      <FlatList
        data={filteredReminders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReminderCard item={item} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={[
          styles.listContent,
          filteredReminders.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
      />

      {/* 浮动「+」添加按钮 (避开底部 TabBar 遮挡，保持高 zIndex) */}
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 64 },
        ]}
        onPress={() => setIsAddModalVisible(true)}
        activeOpacity={0.8}
        accessibilityLabel="新建提醒"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 新建提醒弹窗 */}
      <AddReminderModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAdd={handleAdd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#E8F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 4,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  filterBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  listContent: {
    paddingVertical: 10,
    paddingBottom: 140,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 9999,
  },
  fabText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -2,
  },
});
