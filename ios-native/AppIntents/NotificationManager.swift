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
        
        var targetComponents = DateComponents()
        targetComponents.year = year
        targetComponents.month = month
        targetComponents.day = day
        targetComponents.hour = hour
        targetComponents.minute = minute
        targetComponents.second = 0
        
        guard let originalDate = Calendar.current.date(from: targetComponents) else { return }
        
        let now = Date()
        var nextDate = originalDate
        
        if nextDate <= now {
            switch item.repeatRule {
            case "none":
                return // 已过期的一次性提醒不调度，避免刚创建即触发
            case "half_hourly":
                while nextDate <= now {
                    nextDate = nextDate.addingTimeInterval(1800)
                }
            case "hourly":
                while nextDate <= now {
                    if let d = Calendar.current.date(byAdding: .hour, value: 1, to: nextDate) {
                        nextDate = d
                    } else { break }
                }
            case "daily":
                while nextDate <= now {
                    if let d = Calendar.current.date(byAdding: .day, value: 1, to: nextDate) {
                        nextDate = d
                    } else { break }
                }
            case "weekly":
                while nextDate <= now {
                    if let d = Calendar.current.date(byAdding: .day, value: 7, to: nextDate) {
                        nextDate = d
                    } else { break }
                }
            default:
                return
            }
        }
        
        let timeIntervalToNext = nextDate.timeIntervalSince(now)
        var trigger: UNNotificationTrigger
        
        switch item.repeatRule {
        case "none":
            let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
            trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
        case "half_hourly":
            if timeIntervalToNext <= 1800 {
                trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, timeIntervalToNext), repeats: false)
            } else {
                let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
            }
        case "hourly":
            if timeIntervalToNext <= 3600 {
                var dc = DateComponents()
                dc.minute = Calendar.current.component(.minute, from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
            } else {
                let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
            }
        case "daily":
            if timeIntervalToNext <= 86400 {
                var dc = DateComponents()
                dc.hour = Calendar.current.component(.hour, from: nextDate)
                dc.minute = Calendar.current.component(.minute, from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
            } else {
                let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
            }
        case "weekly":
            if timeIntervalToNext <= 7 * 86400 {
                var dc = DateComponents()
                dc.weekday = Calendar.current.component(.weekday, from: nextDate)
                dc.hour = Calendar.current.component(.hour, from: nextDate)
                dc.minute = Calendar.current.component(.minute, from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
            } else {
                let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
            }
        default:
            let dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: nextDate)
            trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
        }
        
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [item.id])
        let request = UNNotificationRequest(identifier: item.id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
    
    public func cancelNotification(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}
