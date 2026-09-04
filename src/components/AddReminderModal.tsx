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
import type { CreateReminderInput, RepeatRule } from '../types/reminder';
import { DEFAULT_TIME, DEFAULT_REPEAT } from '../services/defaults';

export interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: CreateReminderInput) => void;
}

function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const AddReminderModal: React.FC<AddReminderModalProps> = ({ visible, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(getLocalTodayString());
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
    setDate(getLocalTodayString());
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
