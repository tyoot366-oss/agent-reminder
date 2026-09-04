import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { parseUrlScheme, executeUrlAction } from '@/services/urlScheme';
import { defaultStorage } from '@/services/storage';
import { defaultNotificationEngine } from '@/services/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // 监听外部 Agent 通过 URL Scheme 唤起
    const handleUrl = (event: { url: string }) => {
      if (event?.url) {
        const action = parseUrlScheme(event.url);
        executeUrlAction(action, defaultStorage, defaultNotificationEngine).catch((err) => {
          console.error('Failed to execute URL action:', err);
        });
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // 处理冷启动时的初始 URL
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          const action = parseUrlScheme(url);
          executeUrlAction(action, defaultStorage, defaultNotificationEngine).catch((err) => {
            console.error('Failed to execute initial URL action:', err);
          });
        }
      })
      .catch((err) => {
        console.error('Failed to get initial URL:', err);
      });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
