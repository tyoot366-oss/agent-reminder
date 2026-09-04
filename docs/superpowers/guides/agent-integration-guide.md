# iOS 17.1+ Agent 提醒事项第三方接入与集成开发指南 (Agent Integration Guide)

> **版本**：v1.0.0  
> **适用环境**：iOS 17.1+ / Expo SDK 57 / React Native 0.86  
> **面向对象**：AI Agent 开发者、快捷指令 (Shortcuts) 自动化创作者、脚本开发者 (Scriptable / Pythonista / Webhooks)

---

## 目录
1. [系统概述与核心设计原则](#1-系统概述与核心设计原则)
2. [数据模型与统一默认值机制](#2-数据模型与统一默认值机制)
3. [系统架构与通知触发引擎](#3-系统架构与通知触发引擎)
4. [iOS 17.1+ App Intents 原生接口规范](#4-ios-171-app-intents-原生接口规范)
5. [URL Scheme 自动化调用协议 (`agentreminder://`)](#5-url-scheme-自动化调用协议-agentreminder)
6. [iOS「快捷指令 (Shortcuts)」实战集成步骤](#6-ios快捷指令-shortcuts实战集成步骤)
7. [主流 AI Agent 系统提示词与 Tool Definition 模版](#7-主流-ai-agent-系统提示词与-tool-definition-模版)
8. [常见问题与故障排查 (Troubleshooting)](#8-常见问题与故障排查-troubleshooting)

---

## 1. 系统概述与核心设计原则

Agent 提醒事项是一款专为 iOS 17.1+ 深度优化的轻量级自动化优先应用。其核心使命是消除人类与 AI Agent、外部自动化脚本之间的任务流转壁垒。

### 核心特性
- **两极调用兼容**：既支持 Apple 原生最新一代的 **`AppIntents` 框架**（原生 Siri、快捷指令原子操作、后台静默执行），也支持通用的 **URL Scheme 协议**（`agentreminder://`，零配置唤起）。
- **统一默认值引擎**：外部调用者可极致精简入参，任何缺失参数均由核心引擎自动注入统一默认规则。
- **即时通知闭环**：无论由原生 App Intents 静默写入，还是由前台 URL 唤起写入，均实时调度 iOS 系统级 `UNUserNotificationCenter` 本地通知。
- **App Group 跨进程共享**：原生 Swift 扩展与 React Native 运行时无缝共享同一个持久化存储层。

---

## 2. 数据模型与统一默认值机制

### 2.1 提醒数据模型 (`ReminderItem`)

| 字段名称 | 类型 | 必填 | 默认值 | 约束与格式说明 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` | 是 | 自动生成 | 唯一标识符，格式如 `rem_1725450000000_abc123` |
| `title` | `string` | 是 | 无 | 提醒标题内容，不可为空白字符 |
| `notes` | `string` | 否 | `""` | 详细备注、调用来源标识（如 `From: Claude Agent`） |
| `date` | `string` | 否 | **当前本地日期** | 提醒触发日期，标准 ISO 格式 `YYYY-MM-DD` |
| `time` | `string` | 否 | **`"08:00"`** | 提醒触发时间，24小时制 `HH:mm`（缺失时默认早上 8 点） |
| `repeat` | `RepeatRule` | 否 | **`"hourly"`** | 循环重复策略（缺失时默认每小时提醒） |
| `isCompleted` | `boolean` | 否 | `false` | 完成状态：`false` (待办) / `true` (已完成) |
| `createdAt` | `number` | 是 | 当前毫秒戳 | Unix 毫秒时间戳 |
| `updatedAt` | `number` | 是 | 当前毫秒戳 | Unix 毫秒时间戳 |
| `notificationId` | `string` | 否 | 同 `id` | 绑定的 iOS 系统通知标识符 |

### 2.2 重复规则枚举 (`RepeatRule`)

| 枚举值 | 英文标识 | 调度行为与语义解释 |
| :--- | :--- | :--- |
| **`none`** | 单次提醒 | 仅在设定的 `date` 和 `time` 触发一次，之后不再循环。 |
| **`half_hourly`** | 每半小时 | 自首次触发后，系统每隔 1800 秒（30分钟）循环通知一次。 |
| **`hourly`** | **每小时 (默认)** | 在每个小时的指定分钟数整点触发（如设定 08:15，则在 09:15, 10:15... 循环）。 |
| **`daily`** | 每日提醒 | 每天固定在该 `time`（时:分）准点触发。 |
| **`weekly`** | 每周提醒 | 每周固定在该星期的该 `time`（星期几、时、分）准点触发。 |

> [!IMPORTANT]
> **默认值黄金法则**：  
> 当外部 Agent 或自动化脚本仅提供 `title`（例如 `"喝水提醒"`）时，系统自动补齐为：
> - `date` = 今天的日期（如 `2026-09-04`）
> - `time` = `"08:00"`
> - `repeat` = `"hourly"`
> 
> 这意味着最少仅需传递 1 个参数即可完成一次极高频次且合乎规整的待办创建。

---

## 3. 系统架构与通知触发引擎

### 3.1 架构拓扑

```
┌────────────────────────────────────────────────────────────────────────┐
│                        外部自动化调用来源 (Callers)                    │
│   • Siri 语音交互          • iOS 快捷指令 (Shortcuts)                   │
│   • 第三方 AI Agent (Dify) • 自动化脚本 (Scriptable, Pythonista)        │
└──────────────────┬─────────────────────────────────────┬───────────────┘
                   │ [App Intents API]                   │ [agentreminder://]
                   ▼                                     ▼
┌──────────────────────────────────┐   ┌─────────────────────────────────┐
│     iOS 原生扩展层 (Swift)        │   │    Expo / React Native 前台运行时│
│   • CreateReminderIntent         │   │   • Linking 深度链接监听器      │
│   • ListRemindersIntent          │   │   • URL 格式校验与 1000ms 防重  │
│   • DeleteReminderIntent         │   │   • FilterBar 筛选与 UI 状态    │
│   • AppShortcutsProvider         │   │   • AutomationTester 调试面板   │
└──────────────────┬───────────────┘   └─────────────────┬───────────────┘
                   │                                     │
                   ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   App Group 共享持久化存储 (reminders.json)            │
│                 group.com.anonymous.agentreminder                      │
└──────────────────┬─────────────────────────────────────┬───────────────┘
                   │                                     │
                   ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               iOS 本地通知核心 (UNUserNotificationCenter)               │
│   • UNCalendarNotificationTrigger (单次 / 每小时 / 每日 / 每周)        │
│   • UNTimeIntervalNotificationTrigger (每半小时 1800s 循环)             │
│   • 交互式通知操作 (标为完成 / 推迟 10 分钟)                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 通知触发器构建逻辑

本地通知引擎根据不同的 `repeat` 规则配置精准的 `UNNotificationTrigger`：

1. **单次提醒 (`none`)**：
   ```typescript
   // 严格匹配目标年月日时分，repeats: false
   const trigger = {
     type: 'calendar',
     year: 2026, month: 9, day: 4, hour: 8, minute: 0,
     repeats: false
   };
   ```
2. **每半小时 (`half_hourly`)**：
   ```typescript
   // 基于时间间隔，每 1800 秒循环触发
   const trigger = {
     type: 'timeInterval',
     seconds: 1800,
     repeats: true
   };
   ```
3. **每小时 (`hourly`)**：
   ```typescript
   // 忽略年月日和小时，仅匹配 minute，每个小时的第 N 分钟循环触发
   const trigger = {
     type: 'calendar',
     minute: targetMinute,
     repeats: true
   };
   ```
4. **每日 (`daily`)**：
   ```typescript
   // 忽略年月日，匹配 hour 和 minute
   const trigger = {
     type: 'calendar',
     hour: targetHour, minute: targetMinute,
     repeats: true
   };
   ```
5. **每周 (`weekly`)**：
   ```typescript
   // 匹配 weekday (1-7), hour 和 minute
   const trigger = {
     type: 'calendar',
     weekday: targetWeekday, hour: targetHour, minute: targetMinute,
     repeats: true
   };
   ```

---

## 4. iOS 17.1+ App Intents 原生接口规范

应用内嵌了基于 Swift 5.9 / iOS 17.1+ 的 `AppIntents` 模块，无需打开 App 前台，系统将在后台沙盒内以毫秒级速度完成静默调用。

### 4.1 `CreateReminderIntent` (创建提醒)

- **意图标识**：`CreateReminderIntent`
- **显示名称**：`创建提醒`
- **参数规格**：

| 参数字段 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :---: | :--- | :--- |
| `title` | `String` | 是 | 无 | 提醒事项的标题 |
| `date` | `Date` | 是 | 无 | 提醒设定的起始日期 |
| `time` | `String?` | 否 | `"08:00"` | 提醒触发时间，格式如 `"14:30"` |
| `repeatRule` | `RepeatAppEnum?` | 否 | `.hourly` | 重复规则：`.none`, `.halfHourly`, `.hourly`, `.daily`, `.weekly` |
| `notes` | `String?` | 否 | `nil` | 备注说明 |

- **执行结果**：
  返回创建生成的 `reminderID`，并在 Siri / 弹窗中提供语音与文本反馈：
  > “已为您成功创建提醒「标题」，将于 2026-09-04 08:00 提醒。”

### 4.2 `ListRemindersIntent` (查看提醒列表)

- **意图标识**：`ListRemindersIntent`
- **显示名称**：`查看提醒列表`
- **参数规格**：

| 参数字段 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :---: | :--- | :--- |
| `includeCompleted`| `Bool` | 否 | `false` | 是否返回已标记为完成的提醒 |

- **返回实体**：`[ReminderAppEntity]`
  包含属性：`id`, `title`, `date`, `time`, `repeatRule`, `isCompleted`。
- **对话输出**：
  > “共找到 N 条提醒事项”

### 4.3 `DeleteReminderIntent` (删除提醒)

- **意图标识**：`DeleteReminderIntent`
- **显示名称**：`删除提醒`
- **参数规格**：

| 参数字段 | 类型 | 必填 | 描述 |
| :--- | :--- | :---: | :--- |
| `reminderID` | `String` | 是 | 要删除的提醒 ID |

- **执行结果**：
  返回布尔值（`true` 表示成功，`false` 表示未找到），并同步取消对应的待触发本地通知。

### 4.4 系统预置快捷指令短语 (`AppShortcutsProvider`)

用户在 iOS 17.1+ 设备上安装本 App 后，以下 Siri 短语**立即可用，零配置免手动创建**：
- *“嘿 Siri，用 Agent 提醒 创建提醒”*
- *“嘿 Siri，在 Agent 提醒 添加待办”*
- *“嘿 Siri，用 Agent 提醒 查看提醒”*
- *“嘿 Siri，查看 Agent 提醒 待办”*

---

## 5. URL Scheme 自动化调用协议 (`agentreminder://`)

URL Scheme 适用于各类通用环境，如移动端浏览器、Markdown 笔记软件（Obsidian、Notion）、iOS 脚本应用（Scriptable）或任何支持打开 URL 的环境。

### 5.1 协议基础格式
```
agentreminder://{action}?{parameters}
```

> [!TIP]
> 1. `action` 与参数名不区分大小写，`Create` 与 `create` 等价。
> 2. 所有参数值若包含中文、空格或特殊标点，**必须进行标准 URL 编码（Percent-Encoding）**。
> 3. 前台监听引擎内置 1000ms 重复 URL 过滤器，保障连续多次触发时不发生重复写入。

### 5.2 动作列表与示例

#### 动作 1：`create` (创建提醒)
- **URL 模式**：`agentreminder://create?title={title}&date={YYYY-MM-DD}&time={HH:mm}&repeat={rule}&notes={notes}`
- **参数说明**：
  - `title`（或 `text`）：**必填**。提醒内容。
  - `date`：可选。默认今日。若指定则须为 `YYYY-MM-DD` 格式。
  - `time`：可选。**默认 `08:00`**。格式 `HH:mm`。
  - `repeat`：可选。**默认 `hourly`**。可选值：`none` \| `half_hourly` \| `hourly` \| `daily` \| `weekly`。
  - `notes`：可选。备注信息。
- **调用示例**：

*示例 A：最简调用（全默认：今日、08:00、每小时重复）*
```
agentreminder://create?title=%E5%96%9D%E6%B0%B4%E6%8F%90%E9%86%92
```
*(原始文本: `agentreminder://create?title=喝水提醒`)*

*示例 B：完整参数调用*
```
agentreminder://create?title=%E6%9C%9D%E4%BC%9A%E6%8A%A5%E5%91%8A&date=2026-09-05&time=09%3A30&repeat=daily&notes=%E7%A7%BB%E5%8A%A8%E7%AB%AF%E9%A1%B9%E7%9B%AE%E5%AE%A1%E6%9F%A5
```
*(原始文本: `agentreminder://create?title=朝会报告&date=2026-09-05&time=09:30&repeat=daily&notes=移动端项目审查`)*

#### 动作 2：`list` (查看提醒)
- **URL 模式**：`agentreminder://list?filter={all|pending|completed}`
- **参数说明**：
  - `filter`：过滤范围，默认 `all`。可选 `pending`（仅未完成待办）或 `completed`（已完成）。
- **调用示例**：
```
agentreminder://list?filter=pending
```

#### 动作 3：`toggle` (切换完成状态)
- **URL 模式**：`agentreminder://toggle?id={id}`
- **说明**：将待办标记为已完成（同时取消待发送通知）；或将已完成恢复为待办（同时重新恢复调度通知）。
- **调用示例**：
```
agentreminder://toggle?id=rem_1725450000000_abc123
```

#### 动作 4：`delete` (删除提醒)
- **URL 模式**：`agentreminder://delete?id={id}`
- **说明**：从持久化数据中永久删除，并销毁系统通知请求。
- **调用示例**：
```
agentreminder://delete?id=rem_1725450000000_abc123
```

---

## 6. iOS「快捷指令 (Shortcuts)」实战集成步骤

在 iOS 设备上利用快捷指令可以快速编排复杂的工作流。

### 6.1 场景一：利用原生 App Intent 极速建单 (推荐)

1. 打开 iOS 自带的 **快捷指令 (Shortcuts)** 应用。
2. 点击右上角 **`+`** 新建快捷指令，命名为例如 *“Agent 自动化提醒”*。
3. 点击底部搜索栏，输入应用名称（**`Agent 提醒`**）。
4. 在操作列表中直接选择 **`创建提醒`** 动作块。
5. 配置各输入项：
   - **标题**：点击可绑定快捷指令输入、剪贴板文本或运行参数。
   - **日期**：选择 `当前日期` 或特定日期。
   - **时间**：若留空，将自动以系统默认的 `08:00` 运行。
   - **重复规则**：默认为 `每小时`，亦可在下拉菜单切换为 `每日` / `不重复` 等。
6. 点击右上角运行测试，即可在无需打开 App 前台的情况下直接于后台创建提醒并收到系统横幅提示。

```
┌──────────────────────────────────────────────┐
│  快捷指令动作块示意                          │
│  ┌────────────────────────────────────────┐  │
│  │ 🔔 Agent 提醒：创建提醒                 │  │
│  │    标题: [快捷指令输入]                │  │
│  │    日期: [当前日期]                    │  │
│  │    时间: [留空即 08:00]                │  │
│  │    重复: [每小时]                      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 6.2 场景二：基于 URL Scheme 构建外部应用跳转

适用于从其他第三方 App（如 Drafts, Launcher, Scriptable）唤起：
1. 新建快捷指令，添加 **`URL`** 操作。
2. 输入内容：
   ```
   agentreminder://create?title=提交周报&time=17:00&repeat=weekly
   ```
3. 添加下一个操作：**`打开 URL`**。
4. 运行该快捷指令，即可自动跳转至 Agent 提醒并立即完成记录。

---

## 7. 主流 AI Agent 系统提示词与 Tool Definition 模版

### 7.1 通用 System Prompt (适用于 ChatGPT / Claude / Kimi / 智谱)

在你的 Agent 系统提示词（System Prompt）中添加以下规范段落：

````markdown
### 外部工具能力：iOS Agent 提醒事项集成
你具备通过 URL Scheme 为用户在 iOS 设备上创建待办事项的能力。

协议接口定义：
`agentreminder://create?title={title}&date={YYYY-MM-DD}&time={HH:mm}&repeat={repeat}&notes={notes}`

系统默认注入规则（极其重要）：
1. 默认时间（time）：若用户未明确指定时间，默认值为 `08:00`（早晨8点）。
2. 默认重复（repeat）：若用户未明确指定重复频率，默认值为 `hourly`（每小时提醒）。
3. 默认日期（date）：若未指定日期，默认使用今日本地日期（YYYY-MM-DD）。
4. repeat 选项枚举：`none` (不重复), `half_hourly` (每30分钟), `hourly` (每小时), `daily` (每天), `weekly` (每周)。

输出要求：
当用户表达需要创建提醒、待办或备忘时：
1. 提取任务内容作为 `title`。
2. 将参数进行标准 URL 编码（encodeURIComponent）。
3. 按照如下 Markdown 格式输出供用户点击或自动调用的链接：
   `[点击添加到 Agent 提醒](agentreminder://create?title={encodedTitle}&date={date}&time={time}&repeat={repeat})`
4. 简要说明提醒的触发时间与重复模式（例如：“已为您生成提醒链接，设定于明天 08:00 触发，每小时重复”）。
````

### 7.2 OpenAI Function Calling / Tool Definition (JSON Schema)

若使用 GPT-4o / Claude 3.5 Function Calling 模式，使用下列标准 Tool Schema：

```json
{
  "type": "function",
  "function": {
    "name": "create_ios_reminder",
    "description": "在用户的 iOS 设备 Agent 提醒应用中创建待办与通知提醒。若时间或重复规则未指定，系统将应用 08:00 和 hourly 默认值。",
    "parameters": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "提醒事项的标题或内容，例如：'喝水'、'整理团队周报'"
        },
        "date": {
          "type": "string",
          "description": "提醒设定的触发日期，格式为 YYYY-MM-DD。若未提供则为当前日期。"
        },
        "time": {
          "type": "string",
          "description": "提醒设定的触发时间，24小时制 HH:mm。默认值为 '08:00'。",
          "default": "08:00"
        },
        "repeat": {
          "type": "string",
          "enum": ["none", "half_hourly", "hourly", "daily", "weekly"],
          "description": "重复规则。默认值为 'hourly'。",
          "default": "hourly"
        },
        "notes": {
          "type": "string",
          "description": "可选的补充备注信息或来源 Agent 标记。"
        }
      },
      "required": ["title"]
    }
  }
}
```

#### Tool 执行处理函数示例 (TypeScript)

```typescript
export function handleCreateReminderToolCall(args: {
  title: string;
  date?: string;
  time?: string;
  repeat?: 'none' | 'half_hourly' | 'hourly' | 'daily' | 'weekly';
  notes?: string;
}): { url: string; displayMarkdown: string } {
  const resolvedDate = args.date || new Date().toISOString().split('T')[0];
  const resolvedTime = args.time || '08:00';
  const resolvedRepeat = args.repeat || 'hourly';

  const params = new URLSearchParams({
    title: args.title,
    date: resolvedDate,
    time: resolvedTime,
    repeat: resolvedRepeat,
  });

  if (args.notes) {
    params.append('notes', args.notes);
  }

  const url = `agentreminder://create?${params.toString()}`;
  return {
    url,
    displayMarkdown: `[一键添加到待办提醒](${url})`,
  };
}
```

### 7.3 Python / AutoGPT / LangChain 工具实现示例

```python
import urllib.parse
from datetime import datetime

class AgentReminderTool:
    """Agent 提醒事项自动化创建工具"""
    
    @staticmethod
    def build_reminder_url(
        title: str,
        date: str = None,
        time: str = "08:00",
        repeat: str = "hourly",
        notes: str = ""
    ) -> str:
        """
        构建唤起 agentreminder:// 的标准化 URL
        :param title: 提醒事项标题 (必填)
        :param date: 格式 YYYY-MM-DD，默认今天
        :param time: 格式 HH:mm，默认 08:00
        :param repeat: none | half_hourly | hourly | daily | weekly，默认 hourly
        :param notes: 可选备注
        :return: 编码后的 URL Scheme 字符串
        """
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
            
        params = {
            "title": title,
            "date": date,
            "time": time or "08:00",
            "repeat": repeat or "hourly"
        }
        if notes:
            params["notes"] = notes
            
        query_string = urllib.parse.urlencode(params)
        return f"agentreminder://create?{query_string}"

# 示例调用
url = AgentReminderTool.build_reminder_url(
    title="复盘系统上线指标",
    time="10:00",
    repeat="daily",
    notes="关注 CPU 与延迟指标"
)
print("生成的自动化链接:", url)
# 输出: agentreminder://create?title=%E5%A4%8D%E7%9B%98%E7%B3%BB%E7%BB%9F%E4%B8%8A%E7%BA%BF%E6%8C%87%E6%A0%87&date=2026-09-04&time=10%3A00&repeat=daily&notes=%E5%85%B3%E6%B3%A8+CPU+%E4%B8%8E%E5%BB%B6%E8%BF%9F%E6%8C%87%E6%A0%87
```

---

## 8. 常见问题与故障排查 (Troubleshooting)

### Q1: 触发了 URL Scheme 或 App Intent 之后，手机未弹出横幅通知？
- **检查通知权限**：确保在 iOS 设置 -> `Agent 提醒` 中允许了「通知」权限（包括锁屏、横幅、声音）。在 App 的「Agent 与自动化」Tab 页面中可直接查看当前通知授权状态。
- **专注模式 (Focus Mode) / 勿扰模式**：检查设备当前是否开启了勿扰模式或特定专注模式，该模式可能折叠非紧急通知。
- **触发时间点**：如果是单次提醒 (`none`) 且设定的时间早于当前时间，系统不会补发过期通知。

### Q2: 重复规则的触发时机是如何计算的？
- `hourly`（每小时）：并非以点击创建时的时间为准，而是**以设定的 `time` 中的分钟数（Minute）为准**。例如设为 `08:20`，则会在后续所有小时的 20 分准点收到提醒（09:20, 10:20...）。
- `half_hourly`（每半小时）：采用 `1800` 秒时间间隔计数器，循环周期稳定。

### Q3: 为什么连续高频点击相同的测试 URL 只有一条数据被写入？
- 框架内实现了 **1000ms URL 防抖与去重机制**，防止外部脚本或重复连击产生脏数据。如需批量插入不同提醒，请确保各任务具备不同的标题或间隔 1 秒以上调用。

### Q4: 原生 App Intents 写入的数据，打开 App 能看到吗？
- 可以。App Intents 与 React Native 前台共用名为 `group.com.anonymous.agentreminder` 的 App Group 沙盒。应用进入前台（`AppState: active`）时会自动重新从共享存储拉取最新提醒清单。

---

## 附录：接口速查卡片

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Agent 提醒事项 极简速查表                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 协议 Scheme   │ agentreminder://create                                      │
│ 最简参数       │ ?title={标题}                                               │
│ 默认时间       │ 08:00                                                       │
│ 默认重复       │ hourly (每小时)                                             │
│ 默认日期       │ 当天 (YYYY-MM-DD)                                           │
│ 快捷指令动作   │「Agent 提醒」-> 创建提醒 / 查看提醒列表 / 删除提醒          │
│ Siri 语音指令  │“嘿 Siri，用 Agent 提醒 创建提醒”                            │
└─────────────────────────────────────────────────────────────────────────────┘
```
