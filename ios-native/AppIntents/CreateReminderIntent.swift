import AppIntents
import Foundation

public enum RepeatAppEnum: String, AppEnum {
    case none = "none"
    case halfHourly = "half_hourly"
    case hourly = "hourly"
    case daily = "daily"
    case weekly = "weekly"
    
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "重复规则"
    public static var caseDisplayRepresentations: [RepeatAppEnum: DisplayRepresentation] = [
        .none: "不重复",
        .halfHourly: "每半小时",
        .hourly: "每小时",
        .daily: "每日",
        .weekly: "每周"
    ]
}

public struct CreateReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "创建提醒"
    public static var description: IntentDescription = "创建一个新的提醒事项，自动应用默认时间与重复规则"
    
    @Parameter(title: "标题")
    public var title: String
    
    @Parameter(title: "日期")
    public var date: Date
    
    @Parameter(title: "时间", default: "08:00")
    public var time: String?
    
    @Parameter(title: "重复规则", default: .hourly)
    public var repeatRule: RepeatAppEnum?
    
    @Parameter(title: "备注")
    public var notes: String?
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<String> & ProvidesDialog {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)
        
        let resolvedTime = (time != nil && !time!.isEmpty) ? time! : "08:00"
        let resolvedRepeat = (repeatRule ?? .hourly).rawValue
        let id = "rem_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(6))"
        
        let newItem = SwiftReminderItem(
            id: id,
            title: title,
            notes: notes,
            date: dateString,
            time: resolvedTime,
            repeatRule: resolvedRepeat,
            isCompleted: false,
            createdAt: Date().timeIntervalSince1970 * 1000,
            updatedAt: Date().timeIntervalSince1970 * 1000,
            notificationId: id
        )
        
        ReminderDataBridge.shared.addReminder(newItem)
        NativeNotificationManager.shared.scheduleNotification(for: newItem)
        
        let summary = "已为您成功创建提醒「\(title)」，将于 \(dateString) \(resolvedTime) 提醒。"
        return .result(value: id, dialog: IntentDialog(stringLiteral: summary))
    }
}
