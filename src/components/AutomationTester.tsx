import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';

function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const AutomationTester: React.FC = () => {
  const [testTitle, setTestTitle] = useState('测试 Agent 提醒');
  const [testDate, setTestDate] = useState(getLocalTodayString());
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

  const copyPrompt = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(agentPrompt).catch(() => {});
    }
    Alert.alert('已复制提示词', 'AI Agent 接入提示词已准备就绪，可直接粘贴使用。');
  };

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
          <Text style={styles.promptText} selectable={true}>
            {agentPrompt}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyButton} onPress={copyPrompt} activeOpacity={0.7}>
          <Text style={styles.copyButtonText}>📋 复制提示词</Text>
        </TouchableOpacity>
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
  copyButton: {
    marginTop: 10,
    backgroundColor: '#E8F3FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
