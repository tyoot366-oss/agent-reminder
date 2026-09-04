const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

const withAppIntents = (config) => {
  // 配置 Info.plist 中的权限描述与 URL Scheme
  config = withInfoPlist(config, (config) => {
    config.modResults.NSUserNotificationsUsageDescription =
      '需要您的通知权限以便在设定的时间准时提醒您待办事项。';
    return config;
  });

  // 配置 App Groups 共享容器 Entitlement
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [
      'group.com.anonymous.myapp',
    ];
    return config;
  });

  return config;
};

module.exports = withAppIntents;
