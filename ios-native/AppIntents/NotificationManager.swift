import Foundation
import UserNotifications

public class NativeNotificationManager {
    public static let shared = NativeNotificationManager()
    
    public func scheduleNotification(for item: SwiftReminderItem) {
        let content = UNMutableNotificationContent()
        content.title = item.title
        if let notes = item.notes, !notes.isEmpty {
            content.body = notes
        }
        content.sound = .default
        
        let components = item.date.split(separator: "-")
        let timeComponents = item.time.split(separator: ":")
        
        guard components.count == 3, timeComponents.count == 2,
              let year = Int(components[0]), let month = Int(components[1]), let day = Int(components[2]),
              let hour = Int(timeComponents[0]), let minute = Int(timeComponents[1]) else {
            return
        }
        
        var dateComponents = DateComponents()
        dateComponents.hour = hour
        dateComponents.minute = minute
        
        var trigger: UNNotificationTrigger
        
        switch item.repeatRule {
        case "half_hourly":
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1800, repeats: true)
        case "hourly":
            dateComponents.hour = nil // 匹配每小时的该分钟
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        case "daily":
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        case "weekly":
            var targetComponents = DateComponents()
            targetComponents.year = year
            targetComponents.month = month
            targetComponents.day = day
            if let targetDate = Calendar.current.date(from: targetComponents) {
                dateComponents.weekday = Calendar.current.component(.weekday, from: targetDate)
            }
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        default:
            dateComponents.year = year
            dateComponents.month = month
            dateComponents.day = day
            trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
        }
        
        let request = UNNotificationRequest(identifier: item.id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
    
    public func cancelNotification(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}
