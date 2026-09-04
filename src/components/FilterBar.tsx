import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { FilterType } from '../types/reminder.ts';

export type { FilterType };

export interface FilterBarProps {
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
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
    </ScrollView>
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
