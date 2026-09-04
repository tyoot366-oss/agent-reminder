import AppIntents
import Foundation

public struct ReminderAppEntity: AppEntity {
    public static var defaultQuery = ReminderQuery()
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "提醒项目"
    
    public var id: String
    public var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(date) \(time) (\(repeatRule))")
    }
    
    @Property(title: "标题")
    public var title: String
    
    @Property(title: "日期")
    public var date: String
    
    @Property(title: "时间")
    public var time: String
    
    @Property(title: "重复规则")
    public var repeatRule: String
    
    @Property(title: "是否已完成")
    public var isCompleted: Bool
    
    public init(id: String, title: String, date: String, time: String, repeatRule: String, isCompleted: Bool) {
        self.id = id
        self.title = title
        self.date = date
        self.time = time
        self.repeatRule = repeatRule
        self.isCompleted = isCompleted
    }
}

public struct ReminderQuery: EntityQuery {
    public init() {}
    
    public func entities(for identifiers: [String]) async throws -> [ReminderAppEntity] {
        let all = ReminderDataBridge.shared.loadReminders()
        return all.filter { identifiers.contains($0.id) }.map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
    }
    
    public func suggestedEntities() async throws -> [ReminderAppEntity] {
        return ReminderDataBridge.shared.loadReminders().map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
    }
}

public struct ListRemindersIntent: AppIntent {
    public static var title: LocalizedStringResource = "查看提醒列表"
    public static var description: IntentDescription = "获取当前所有待办或全部提醒列表"
    
    @Parameter(title: "包含已完成", default: false)
    public var includeCompleted: Bool
    
    public init() {}
    
    public func perform() async throws -> some ReturnsValue<[ReminderAppEntity]> & ProvidesDialog {
        let all = ReminderDataBridge.shared.loadReminders()
        let filtered = includeCompleted ? all : all.filter { !$0.isCompleted }
        
        let entities = filtered.map {
            ReminderAppEntity(id: $0.id, title: $0.title, date: $0.date, time: $0.time, repeatRule: $0.repeatRule, isCompleted: $0.isCompleted)
        }
        
        return .result(value: entities, dialog: IntentDialog(stringLiteral: "共找到 \(entities.count) 条提醒事项"))
    }
}
