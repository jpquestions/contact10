import Foundation

/// Must match APP_GROUP in src/lib/widget.ts and app.json.
let appGroup = "group.com.jpquestions.contact10"
let milestones = [10, 50, 100, 200, 300, 400, 500, 1000, 2500, 5000, 10000]
let quickAdd = [1, 2, 3, 6, 10]

/// Written by the app (src/lib/widget.ts) as JSON under the "state" key.
struct SharedState: Codable {
  struct Leader: Codable, Hashable {
    var username: String
    var points: Int
  }

  var refreshToken: String
  var apiKey: String
  var functionsBase: String
  var username: String
  var lifetimePoints: Int
  var activeGameId: String?
  var activeGameName: String?
  var gamePoints: Int?
  var leaders: [Leader]
}

/// An entry logged while offline. The app or the next widget tap delivers it.
struct PendingEntry: Codable {
  var entryId: String
  var gameId: String?
  var amount: Int
}

enum Store {
  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func load() -> SharedState? {
    guard let raw = defaults?.string(forKey: "state"), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(SharedState.self, from: data)
  }

  static func save(_ state: SharedState) {
    guard let data = try? JSONEncoder().encode(state), let raw = String(data: data, encoding: .utf8) else { return }
    defaults?.set(raw, forKey: "state")
  }

  static func pending() -> [PendingEntry] {
    guard let raw = defaults?.string(forKey: "pending"), let data = raw.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([PendingEntry].self, from: data)) ?? []
  }

  static func setPending(_ entries: [PendingEntry]) {
    if entries.isEmpty {
      defaults?.removeObject(forKey: "pending")
      return
    }
    guard let data = try? JSONEncoder().encode(entries), let raw = String(data: data, encoding: .utf8) else { return }
    defaults?.set(raw, forKey: "pending")
  }
}

func nextMilestone(after points: Int) -> (floor: Int, next: Int?) {
  let floor = milestones.last(where: { points >= $0 }) ?? 0
  return (floor, milestones.first(where: { points < $0 }))
}
