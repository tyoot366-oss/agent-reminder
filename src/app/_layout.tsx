import React, { useEffect, useRef, useCallback } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { handleIncomingUrl, shouldProcessIncomingUrl } from '@/services/urlScheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const lastProcessedUrlRef = useRef<{ url: string; timestamp: number } | null>(null);

  // 防重处理与 URL 执行函数
  const processUrl = useCallback((url: string) => {
    if (!url) return;
    const now = Date.now();
    if (!shouldProcessIncomingUrl(lastProcessedUrlRef.current, url, now, 1000)) {
      return;
    }
    lastProcessedUrlRef.current = { url, timestamp: now };
    handleIncomingUrl(url).catch((err) => {
      console.error('Failed to execute URL action:', err);
    });
  }, []);

  useEffect(() => {
    // 1. 监听外部 Agent 运行时 URL Scheme 唤起
    const handleUrl = (event: { url: string }) => {
      if (event?.url) {
        processUrl(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // 2. 处理冷启动初始 URL（通过防重机制避免与 addEventListener 重复处理）
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          processUrl(url);
        }
      })
      .catch((err) => {
        console.error('Failed to get initial URL:', err);
      });

    return () => {
      subscription.remove();
    };
  }, [processUrl]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
