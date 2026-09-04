const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

const withAppIntents = (config) => {
  // 配置 Info.plist 中的权限描述与 URL Scheme
  config = withInfoPlist(config, (config) => {
    config.modResults.NSUserNotificationsUsageDescription =
      '需要您的通知权限以便在设定的时间准时提醒您待办事项。';
    return config;
  });

  // 配置 App Groups 共享容器 Entitlement (保留既有条目)
  config = withEntitlementsPlist(config, (config) => {
    const key = 'com.apple.security.application-groups';
    const existing = config.modResults[key] || [];
    const groupIdentifier = 'group.com.anonymous.myapp';
    if (!existing.includes(groupIdentifier)) {
      config.modResults[key] = [...existing, groupIdentifier];
    }
    return config;
  });

  return config;
};

module.exports = withAppIntents;
