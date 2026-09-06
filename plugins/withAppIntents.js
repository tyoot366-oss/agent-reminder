const { withInfoPlist, withEntitlementsPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAppIntents = (config) => {
  // 1. 配置 Info.plist 中的权限描述与通知提示
  config = withInfoPlist(config, (config) => {
    config.modResults.NSUserNotificationsUsageDescription =
      '需要您的通知权限以便在设定的时间准时提醒您待办事项。';
    return config;
  });

  // 2. 配置 App Groups 共享容器 Entitlement (保留既有条目)
  config = withEntitlementsPlist(config, (config) => {
    const key = 'com.apple.security.application-groups';
    const existing = config.modResults[key] || [];
    const groupIdentifier = 'group.com.anonymous.myapp';
    if (!existing.includes(groupIdentifier)) {
      config.modResults[key] = [...existing, groupIdentifier];
    }
    return config;
  });

  // 3. 在 prebuild 生成原生工程时，自动同步原生 Swift App Intents 代码
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, 'ios-native', 'AppIntents');
      const targetDir = path.join(
        platformProjectRoot,
        config.modRequest.projectName || '1',
        'AppIntents'
      );

      if (fs.existsSync(srcDir)) {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
          if (file.endsWith('.swift')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(targetDir, file));
          }
        }
      }
      return config;
    },
  ]);

  return config;
};

module.exports = withAppIntents;
