# iOS 17.1+ 轻量高自动化兼容性提醒事项应用设计规范 (Design Spec)

- **创建日期**：2026-09-04
- **目标平台**：iOS 17.1+ / Expo SDK 57 (React Native 0.86)
- **状态**：Approved (待实施)

---

## 1. 产品定位与核心目标

一款专为 iOS 17.1+ 打造的轻量级、具备极致自动化兼容性的提醒事项应用。
不仅提供符合 Apple Human Interface Guidelines (HIG) 的原生质感 UI 供日常手动管理，更主打能够被各类第三方 AI Agent、快捷指令（Shortcuts）、脚本类 App（如 Scriptable、Pythonista、Webhooks）通过标准原生接口（App Intents）及 URL Scheme 无缝唤起和静默调用。所有提醒事项创建均严格遵循统一的系统级默认值。

---

## 2. 核心要素与默认值规则

每个提醒项（`ReminderItem`）包含以下属性：

| 属性字段 | 类型 | 是否必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 自动生成 UUID | 格式如 `rem_8f9c12a4-...` |
| `title` | `string` | 是 | 无 | 提醒标题内容文本 |
| `notes` | `string` | 否 | `""` | 补充描述、调用来源 Agent 备注等 |
| `date` | `string` | 是 | 无 (必须指定) | 提醒触发日期，格式 `YYYY-MM-DD` |
| `time` | `string` | 否 | `"08:00"` | 提醒触发时间，格式 `HH:mm` |
| `repeat` | `RepeatRule` | 否 | `"hourly"` | 重复规则枚举 |
| `isCompleted` | `boolean` | 否 | `false` | 提醒状态：未完成 (false) / 已完成 (true) |
| `createdAt` | `number` | 是 | 当前毫秒时间戳 | 创建时间戳 |
| `updatedAt` | `number` | 是 | 当前毫秒时间戳 | 最后修改时间戳 |
| `notificationId` | `string` | 否 | `id` | 关联的系统 `UNNotificationRequest` 标识 |

### 重复规则枚举（`RepeatRule`）
- `none`：不重复（单次提醒）
- `half_hourly`：每半小时（自设定时间起每 30 分钟）
- `hourly`：每小时（默认值，在指定分钟整点触发）
- `daily`：每日（每天指定时间触发）
- `weekly`：每周（每周同星期指定时间触发）

---

## 3. 系统架构与调用接口

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                       外部自动化调用方 (Callers)                       │
   │  ┌─────────────────────────────┐    ┌───────────────────────────────┐  │
   │  │  第三方 AI Agent / Siri /    │    │ 外部脚本 / 快捷指令 URL /    │  │
   │  │  快捷指令 (App Intents)     │    │ Scriptable (URL Scheme)       │  │
   │  └──────────────┬──────────────┘    └───────────────┬───────────────┘  │
   └─────────────────┼───────────────────────────────────┼──────────────────┘
                     ▼                                   ▼
   ┌─────────────────────────────────┐   ┌──────────────────────────────────┐
   │    iOS 原生层 (Swift Native)    │   │  React Native / Expo 运行时      │
   │  • AppIntents 模块              │   │  • Linking 深度链接监听器        │
   │  • UNUserNotificationCenter     │   │  • UI 交互 (列表 / 新建 / 筛选)  │
   │  • 后台静默调度引擎             │   │  • 自动化调试面板                │
   └─────────────────┬───────────────┘   └───────────────┬──────────────────┘
                     │                                   │
                     ▼                                   ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                 共享数据存储层 (Shared Storage Engine)                 │
   │       • App Group 共享持久化存储 (reminders.json)                      │
   │       • 两端具备一致的默认值注入机制与校验逻辑                         │
   └────────────────────────────────────────────────────────────────────────┘
```

### 3.1 原生 App Intents 框架（iOS 16+ / 17.1+）

使用 Swift 原生 `AppIntents` 框架实现以下 3 个核心 Intent，并注册 `AppShortcutsProvider`：

1. **`CreateReminderIntent`**
   - **参数**：
     - `@Parameter(title: "标题") var title: String`（必填）
     - `@Parameter(title: "日期") var date: Date`（必填）
     - `@Parameter(title: "时间", default: "08:00") var time: DateComponents?`（可选，默认 08:00）
     - `@Parameter(title: "重复规则", default: .hourly) var repeat: RepeatAppEnum?`（可选，默认 hourly）
     - `@Parameter(title: "备注") var notes: String?`（可选）
   - **行为**：
     - 若 `time` 为空，自动注入 `08:00`；若 `repeat` 为空，自动注入 `.hourly`；
     - 写入共享存储，直接调用 `UNUserNotificationCenter` 注册通知；
   - **返回**：`IntentResultContainer`，包含生成的 `reminderID` 与易于 Agent 理解的成功描述信息。

2. **`ListRemindersIntent`**
   - **参数**：
     - `@Parameter(title: "包含已完成", default: false) var includeCompleted: Bool`
   - **返回**：`[ReminderAppEntity]`（包含 ID、标题、触发时间、重复状态、完成状态）。

3. **`DeleteReminderIntent`**
   - **参数**：
     - `@Parameter(title: "提醒ID") var reminderID: String`（必填）
   - **行为**：从共享存储物理移除，同步取消系统待发送通知。
   - **返回**：操作成功布尔值与结果信息。

4. **`AppShortcutsProvider`**
   - 自动向 iOS 系统提供预置快捷短语：“用 Agent 提醒新建”、“查看待办提醒”，无需用户手动在快捷指令中编写配置。

### 3.2 URL Scheme 自动化协议（`agentreminder://`）

作为次级调用通道，兼容通用脚本和外部 URL：
- **创建**：`agentreminder://create?title={title}&date={YYYY-MM-DD}&time={HH:mm}&repeat={none|half_hourly|hourly|daily|weekly}&notes={notes}`
  - 自动应用默认值：缺少 `time` 补 `08:00`，缺少 `repeat` 补 `hourly`。
- **列表**：`agentreminder://list?filter={all|pending|completed}&x-success={callback}`
- **删除**：`agentreminder://delete?id={id}`
- **完成切换**：`agentreminder://toggle?id={id}`

---

## 4. 本地通知触发引擎与生命周期

### 4.1 通知呈现形式
- **横幅（Banner）**：前台与后台均支持弹出。
- **声音（Sound）**：iOS 原生提示音。
- **锁屏（Lock Screen）**与**通知中心（Notification Center）**：持续保留待办事项。

### 4.2 快捷交互操作（Interactive Actions）
- **Action 1**：`MARK_COMPLETED`（“标为完成”）——直接将状态写为完成，更新 UI 与存储。
- **Action 2**：`SNOOZE_10`（“推迟 10 分钟”）——调度一次 600 秒后的单次提醒。

### 4.3 调度匹配机制（Trigger Scheduling）
- `none`：`UNCalendarNotificationTrigger` 匹配年月日时分。
- `half_hourly`：`UNTimeIntervalNotificationTrigger(timeInterval: 1800, repeats: true)`。
- `hourly`：`UNCalendarNotificationTrigger` 匹配 `minute`（准点循环）。
- `daily`：`UNCalendarNotificationTrigger` 匹配 `hour` 和 `minute`。
- `weekly`：`UNCalendarNotificationTrigger` 匹配 `weekday`、`hour` 和 `minute`。

---

## 5. 前端 UI 架构（React Native / Expo）

采用纯净的高品质 iOS 17 Apple HIG 风格设计：

1. **主屏：提醒清单（`src/app/(tabs)/index.tsx`）**
   - 顶部搜索栏与胶囊式过滤器（全部 / 待办 / 已完成 / 重复中）。
   - 提醒卡片列表：包含完成复选框（附轻微震动反馈）、标题、时间/日期徽章、重复规则标签、左滑/长按删除。
   - 空状态引导与悬浮新建按钮（+）。
2. **模态弹窗：新建/编辑（`src/components/AddReminderModal.tsx`）**
   - 标题输入框（自动聚焦）与备注框。
   - 快捷日期胶囊（今天、明天、本周末）与日期选择器。
   - 时间选择器（预置 08:00）。
   - 重复规则选择器（不重复 / 每半小时 / **每小时[默认]** / 每日 / 每周）。
3. **分屏：自动化与 Agent 中心（`src/app/(tabs)/automation.tsx`）**
   - App Intents 接口说明与在快捷指令中的使用指引。
   - URL Scheme 实时生成与测试器（支持即时填参、一键复制、点击立即测试触发）。
   - 面向第三方 AI Agent 的 System Prompt 示例模版。
   - 系统通知权限状态检测与一键授权引导。

---

## 6. 测试与验证计划

1. **单元测试与逻辑验证**：
   - 默认值注入测试（不传 time 默认为 08:00，不传 repeat 默认为 hourly）。
   - 调度时间计算单元测试（准确计算下一触发点）。
2. **自动化接口调用验证**：
   - URL Scheme 解析与自动创建流程测试。
   - App Intents 格式与数据一致性测试。
3. **跨层数据一致性**：
   - 验证后台写入后前台自动刷新呈现。
