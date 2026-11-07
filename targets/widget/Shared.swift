import Foundation

/// Must match APP_GROUP in src/lib/widget.ts and app.json.
let appGroup = "group.com.jpquestions.contact10"
let milestones = [10, 50, 100, 200, 300, 400, 500, 1000, 2500, 5000, 10000]
let quickAdd = [1, 2, 3, 6, 10]

/// Written by the app (src/lib/widget.ts) as JSON under the "state" key.
/// Mirrors WidgetState in src/widget/core.ts.
struct SharedState: Codable {
  struct Leader: Codable, Hashable {
    var username: String
    var points: Int
  }

  struct Game: Codable, Hashable {
    var id: String
    var name: String
    var points: Int
    var leaders: [Leader]
  }

  var refreshToken: String
  var apiKey: String
  var functionsBase: String
  var username: String
  var lifetimePoints: Int
  var activeGameId: String?
  var games: [Game]
}

/// What the widget adds points to: Personal (no game) or one live game.
enum Target: Equatable {
  case solo
  case game(SharedState.Game)

  var label: String {
    switch self {
    case .solo: return "Personal"
    case .game(let g): return g.name
    }
  }

  var gameId: String? {
    if case .game(let g) = self { return g.id }
    return nil
  }
}

let soloTarget = "solo"

extension SharedState {
  /// Stored choice wins; otherwise follow the app's active game; otherwise Personal.
  func target(chosen: String?) -> Target {
    if chosen == soloTarget { return .solo }
    if let g = games.first(where: { $0.id == chosen }) ?? games.first(where: { $0.id == activeGameId }) {
      return .game(g)
    }
    return .solo
  }

  func points(for target: Target) -> Int {
    switch target {
    case .solo: return lifetimePoints
    case .game(let g): return games.first(where: { $0.id == g.id })?.points ?? g.points
    }
  }

  /// Each live game in order, then Personal, then around again.
  func nextTargetId(after target: Target) -> String {
    let order = games.map(\.id) + [soloTarget]
    let current = target.gameId ?? soloTarget
    let index = order.firstIndex(of: current) ?? -1
    return order[(index + 1) % order.count]
  }

  mutating func add(_ amount: Int, to gameId: String?) {
    lifetimePoints += amount
    if let gameId, let i = games.firstIndex(where: { $0.id == gameId }) { games[i].points += amount }
  }
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

  static var chosenTarget: String? {
    get { defaults?.string(forKey: "target") }
    set { defaults?.set(newValue, forKey: "target") }
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
