import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { ReminderItem } from '../types/reminder';
import { getRepeatIntervalDescription } from '../services/notifications';

export interface ReminderCardProps {
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
