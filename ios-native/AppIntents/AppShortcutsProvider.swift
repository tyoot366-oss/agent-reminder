import AppIntents

public struct AgentReminderShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CreateReminderIntent(),
            phrases: [
                "用 \(.applicationName) 创建提醒",
                "在 \(.applicationName) 添加待办"
            ],
            shortTitle: "新建提醒",
            systemImageName: "bell.badge"
        )
        AppShortcut(
            intent: ListRemindersIntent(),
            phrases: [
                "用 \(.applicationName) 查看提醒",
                "查看 \(.applicationName) 待办"
            ],
            shortTitle: "查看提醒",
            systemImageName: "checklist"
        )
    }
}
