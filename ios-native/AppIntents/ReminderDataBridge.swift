import Foundation

public struct SwiftReminderItem: Codable, Identifiable {
    public var id: String
    public var title: String
    public var notes: String?
    public var date: String
    public var time: String
    public var repeatRule: String
    public var isCompleted: Bool
    public var createdAt: Double
    public var updatedAt: Double
    public var notificationId: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, notes, date, time
        case repeatRule = "repeat"
        case isCompleted, createdAt, updatedAt, notificationId
    }
    
    public init(
        id: String,
        title: String,
        notes: String? = nil,
        date: String,
        time: String,
        repeatRule: String,
        isCompleted: Bool = false,
        createdAt: Double,
        updatedAt: Double,
        notificationId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.date = date
        self.time = time
        self.repeatRule = repeatRule
        self.isCompleted = isCompleted
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.notificationId = notificationId
    }
}

public class ReminderDataBridge {
    public static let shared = ReminderDataBridge()
    private let appGroupIdentifier = "group.com.anonymous.myapp"
    private let fileName = "reminders.json"
    
    private var fileURL: URL? {
        if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            return container.appendingPathComponent(fileName)
        }
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent(fileName)
    }
    
    public func loadReminders() -> [SwiftReminderItem] {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else {
            return []
        }
        return (try? JSONDecoder().decode([SwiftReminderItem].self, from: data)) ?? []
    }
    
    public func saveReminders(_ reminders: [SwiftReminderItem]) {
        guard let url = fileURL, let data = try? JSONEncoder().encode(reminders) else { return }
        try? data.write(to: url)
    }
    
    public func addReminder(_ reminder: SwiftReminderItem) {
        var list = loadReminders()
        list.insert(reminder, at: 0)
        saveReminders(list)
    }
    
    public func deleteReminder(id: String) -> Bool {
        var list = loadReminders()
        let initialCount = list.count
        list.removeAll { $0.id == id }
        if list.count != initialCount {
            saveReminders(list)
            return true
        }
        return false
    }
}
