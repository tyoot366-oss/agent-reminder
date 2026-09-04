import AppIntents
import Foundation

public struct DeleteReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "删除提醒"
    public static var description: IntentDescription = "根据提醒ID从列表中删除并取消通知"
    
    @Parameter(title: "提醒ID")
    public var reminderID: String
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<Bool> & ProvidesDialog {
        let success = ReminderDataBridge.shared.deleteReminder(id: reminderID)
        if success {
            NativeNotificationManager.shared.cancelNotification(id: reminderID)
            return .result(value: true, dialog: "提醒 \(reminderID) 已成功删除")
        } else {
            return .result(value: false, dialog: "未找到 ID 为 \(reminderID) 的提醒")
        }
    }
}
