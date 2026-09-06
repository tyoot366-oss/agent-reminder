# iOS 17.1+ Agent Reminder (自动化提醒事项)

一款专为 **iOS 17.1+** 设计的轻量级、高自动化兼容性的提醒事项应用。

不仅提供原生 Apple HIG 质感的优雅交互界面，更深度集成了 **iOS 17 原生 App Intents 框架** 与全局 **URL Scheme (`agentreminder://`)**，可被各类第三方 AI Agent（如 ChatGPT、Claude、AutoGPT、Dify）、iOS 快捷指令（Shortcuts）以及自动化脚本（Python、Node.js、cURL）无缝静默调用。

---

## 🌟 核心特性

- 🤖 **专为 AI Agent 与自动化设计**
  - **极简要素输入**：只需提供 `title`（标题）与 `date`（日期：`YYYY-MM-DD`）。
  - **统一默认值引擎**：未指定时间统一默认注入 **`08:00`**；未指定重复规则统一默认注入 **`hourly`（每小时）**。
  - **完备重复规则**：支持 `none`（不重复）、`half_hourly`（每 30 分钟）、`hourly`（每小时）、`daily`（每日）、`weekly`（每周）。
- 🚀 **双轨自动化接入机制**
  - **原生 App Intents**：Swift 原生编写，支持后台静默执行，提供 Siri 语音直达与快捷指令原生动作积木。
  - **全局 URL Scheme**：注册 `agentreminder://`，支持跨 App 唤起与数据分发，内置防抖防重机制，兼容 Expo 预览回退。
- 🎨 **Apple HIG 原生视觉质感**
  - 四段式动态筛选标签（全部 / 待办 / 已完成 / 循环中）与动态待办计数徽章。
  - 勾选完成状态切换（支持触感反馈，同步取消或恢复本地通知调度）。
  - 安全区域自适应悬浮按钮（FAB），深度适配全面屏底部手势与原生 TabBar。
  - 内置「自动化与 Agent」调试面板，支持实时测试 URL Scheme、一键复制 Agent Prompt 与快捷指令配置指引。
- 📦 **可靠的持久化与通知系统**
  - **App Group 数据共享**：采用 Expo SDK 57 `File` 与 `Paths` API，与原生 Swift 共享沙盒容器（`group.com.anonymous.myapp/reminders.json`）。
  - **原生本地通知绑定**：深度集成 `expo-notifications` 与 iOS `UNUserNotificationCenter`，保证锁屏横幅与声音准时触发。

---

## 📁 项目结构

```text
.
├── app.json                          # Expo 应用配置 (注册 agentreminder Scheme 与插件)
├── package.json                      # 依赖与脚本定义
├── tsconfig.json                     # TypeScript 配置文件
├── .gitignore                        # 忽略规则 (过滤临时文件与内部代理配置)
│
├── src/                              # 应用源代码
│   ├── app/                          # Expo Router 文件路由
│   │   ├── _layout.tsx               # 根布局 (全局 URL Scheme 监听、防抖去重与分发)
│   │   ├── index.tsx                 # 主界面 (提醒事项流、分类筛选、下拉刷新、FAB)
│   │   └── automation.tsx            # 自动化中心 (URL 调试器、Prompt 复制、快捷指令指南)
│   │
│   ├── components/                   # Apple HIG 风格 UI 组件
│   │   ├── ReminderCard.tsx          # 提醒卡片 (完成状态切换、重复/时间徽章、滑动/点击删除)
│   │   ├── FilterBar.tsx             # 分类胶囊栏 (全部/待办/已完成/循环中 + 计数徽章)
│   │   ├── AddReminderModal.tsx      # 半屏新建弹窗 (自动预填当天日期、08:00 与 hourly)
│   │   ├── AutomationTester.tsx      # 自动化实时调试面板与 Agent Prompt 模板
│   │   └── app-tabs.tsx              # iOS 原生 UITabBar 双标签导航 (提醒 / 自动化)
│   │
│   ├── services/                     # 核心业务逻辑与驱动引擎
│   │   ├── defaults.ts               # 统一默认值注入、日期与时间合法性校验、列表过滤
│   │   ├── storage.ts                # App Group 持久化存储 (Expo SDK 57 File/Paths API)
│   │   ├── notifications.ts          # 本地通知调度引擎 (计算 5 种重复模式触发时间与周期)
│   │   └── urlScheme.ts              # agentreminder:// 协议解析器、时区自适应与动作调度器
│   │
│   └── types/                        # TypeScript 类型定义
│       └── reminder.ts               # ReminderItem、RepeatRule、CreateReminderInput 契约
│
├── ios-native/                       # iOS 原生 Swift App Intents 实现
│   └── AppIntents/
│       ├── CreateReminderIntent.swift# 创建提醒 Intent (默认 08:00, hourly)
│       ├── ListRemindersIntent.swift  # 查询提醒 Intent (支持待办/已完成/全部过滤)
│       ├── DeleteReminderIntent.swift# 删除提醒 Intent
│       ├── AppShortcutsProvider.swift# 快捷指令与 Siri 动作提供者
│       ├── NotificationManager.swift # 原生 UNUserNotificationCenter 调度器
│       └── ReminderDataBridge.swift  # App Group 数据容器文件读写桥接
│
├── plugins/                          # Expo Config Plugin
│   └── withAppIntents.js             # 自动注入 App Groups 配置与通知权限声明
│
├── docs/                             # 项目详细设计与集成指南
│   └── superpowers/
│       ├── guides/
│       │   └── agent-integration-guide.md # 完整的第三方 Agent 接入指南 (含 Function Calling)
│       ├── specs/                    # 原始架构与设计规格书
│       └── plans/                    # 分步实施演进记录
│
└── tests/                            # 单元测试与集成测试套件 (27/27 测试全绿)
    ├── defaults.test.ts              # 默认值规则与格式验证测试
    ├── storage.test.ts               # 本地存储与持久化测试
    ├── notifications.test.ts         # 通知时间计算与 5 种重复规则测试
    ├── urlScheme.test.ts             # URL Scheme 解析、容错与调度测试
    ├── components.test.ts            # UI 数据过滤与计数测试
    └── screens.test.ts               # 前台刷新、深层链接分发与防重测试
```

---

## ⚡ 默认值注入规则

为了让第三方 AI Agent 能够用最精简的参数调用成功，系统统一执行以下默认值补充逻辑：

| 参数 | 字段 | 类型 | 是否必填 | 缺省行为 / 默认值 |
| :--- | :--- | :--- | :---: | :--- |
| **标题** | `title` | `string` | **是** | 无默认值，必须提供具体事项描述 |
| **日期** | `date` | `string` | **是** | 格式 `YYYY-MM-DD`（URL Scheme 缺省时自动回退为设备当天本地日期） |
| **时间** | `time` | `string` | 否 | **自动补全默认值 `"08:00"`** |
| **重复** | `repeat`| `enum` | 否 | **自动补全默认值 `"hourly"`**（支持 `none` \| `half_hourly` \| `hourly` \| `daily` \| `weekly`） |
| **备注** | `notes` | `string` | 否 | 默认为空，可存放 Agent 上下文或备忘信息 |

---

## 🔗 URL Scheme 协议调用规范

应用协议标识为 **`agentreminder://`**，支持直接通过系统打开 URL 或从任意脚本执行。

### 1. 创建提醒 (`create`)
```bash
# 极简调用 (自动应用 08:00 与 hourly 规则)
agentreminder://create?title=购买咖啡豆&date=2026-09-08

# 完整参数调用
agentreminder://create?title=团队周会&date=2026-09-08&time=14:30&repeat=weekly&notes=带上Q3季报
```

### 2. 状态切换 (`toggle`)
```bash
agentreminder://toggle?id=rem_8f9c1234
```

### 3. 删除提醒 (`delete`)
```bash
agentreminder://delete?id=rem_8f9c1234
```

### 4. 查询提醒 (`list`)
```bash
agentreminder://list?filter=pending   # 可选: all | pending | completed | repeating
```

> 详细的 OpenAI Function Calling JSON Schema、Python 脚本示例与 Siri 快捷指令教程，请参考 [docs/superpowers/guides/agent-integration-guide.md](docs/superpowers/guides/agent-integration-guide.md)。

---

## 🛠️ 本地开发与测试

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- iOS 17.1+ (真机测试或 iOS Simulator)
- Xcode 15+ (仅需编译原生 AppIntents 时依赖)

### 安装与启动
```bash
# 1. 安装项目依赖
npm install

# 2. 启动 Expo 开发服务
npx expo start
```
- 在终端中按下 `i` 可在 iOS 模拟器打开；
- 或使用手机端 Expo Go 扫描终端二维码进行即时交互预览。

### 自动化测试
本项目所有核心逻辑均采用严格的 **TDD（测试驱动开发）** 编写，运行全量测试套件：
```bash
node --experimental-strip-types --test tests/*.test.ts
```
*(当前共 27 项自动化测试用例，涵盖默认值、持久化、5 种重复规则调度、URL Scheme 解析防重及页面状态机)*

### TypeScript 编译检查
```bash
npx tsc --noEmit
```

### 原生构建 (iOS App Intents)
若要在真实 iOS 环境下调试原生 Swift `AppIntents` 模块与 App Group 共享：
```bash
npx expo prebuild --platform ios
npx expo run:ios
```

---

## ☁️ 通过 GitHub 云端编译项目

本项目已全面配置 **GitHub Actions 自动化流水线** 与 **Expo EAS Build**，支持在云端直接编译出 iOS 产物：

### 方式 1：通过 GitHub Actions 自动编译 (免费 / 无需 Apple 开发者账号)
项目已内置完整 CI/CD 配置：[`.github/workflows/build-ios.yml`](.github/workflows/build-ios.yml)。
1. **自动触发**：向 `main` 分支提交代码或发起 Pull Request 时自动启动。
2. **手动触发**：
   - 打开 GitHub 仓库页面，点击顶部 **Actions** 标签。
   - 在左侧选择 **CI & iOS Build** 工作流，点击右侧 **Run workflow** 按钮。
3. **获取产物**：
   - 工作流会自动执行测试、TypeScript 校验，并在 GitHub 托管的 `macos-14` (Apple Silicon) 虚拟机上完成原生 iOS 编译。
   - 编译完成后，在 Actions 运行详情页底部的 **Artifacts** 区域即可一键下载 `AgentReminder-iOS-Simulator.tar.gz`（解压后的 `.app` 可直接拖入 Mac 上的 iOS 模拟器运行）。

### 方式 2：通过 Expo EAS Build 编译真机安装包 (.ipa)
项目已内置标准配置文件：[`eas.json`](eas.json)。
```bash
# 1. 安装 EAS CLI 并登录
npm install -g eas-cli
eas login

# 2. 发起云端构建 (免费套餐即可使用)
# 编译模拟器包 (免开发者账号)
eas build --platform ios --profile preview

# 编译真机安装包 / TestFlight (需 Apple 开发者账号)
eas build --platform ios --profile production
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
