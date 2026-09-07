import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Expo Router 未匹配路由兜底组件：
 * 当外部应用或快捷指令通过 agentreminder://create、agentreminder://delete 等非页面路径唤起时，
 * Expo Router 会将 create、delete 等识别为未知页面并尝试路由。
 * 此组件将所有未知路径无感重定向至应用首页 (/)，彻底杜绝 Unmatched Route 报错页面。
 */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
