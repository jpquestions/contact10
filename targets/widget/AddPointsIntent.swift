import AppIntents
import Foundation
import WidgetKit

/// Runs inside the widget when a quick add button is tapped.
struct AddPointsIntent: AppIntent {
  static let title: LocalizedStringResource = "Add points"
  static let description = IntentDescription("Adds points to your active Contact 10 game.")

  @Parameter(title: "Points")
  var amount: Int

  init() {}

  init(amount: Int) {
    self.amount = amount
  }

  func perform() async throws -> some IntentResult {
    guard var state = Store.load() else { return .result() }
    let before = state

    // Show the new total right away; the server result replaces it.
    state.lifetimePoints += amount
    if let points = state.gamePoints { state.gamePoints = points + amount }
    Store.save(state)
    Store.defaults?.removeObject(forKey: "lastError")

    let entry = PendingEntry(entryId: UUID().uuidString.lowercased(), gameId: state.activeGameId, amount: amount)
    do {
      let result = try await Api.addPoints(state, entry)
      state.lifetimePoints = result.lifetimePoints
      if let points = result.gamePoints { state.gamePoints = points }
      Store.save(state)
      await deliverPending(state)
    } catch ApiError.network {
      // Keep the optimistic total and retry later with the same id.
      Store.setPending(Store.pending() + [entry])
    } catch ApiError.rejected(let message) {
      Store.save(before)
      Store.defaults?.set(message, forKey: "lastError")
    } catch {
      // An unreadable reply (server hiccup): treat it like being offline.
      Store.setPending(Store.pending() + [entry])
    }
    return .result()
  }

  private func deliverPending(_ state: SharedState) async {
    var left: [PendingEntry] = []
    for entry in Store.pending() {
      do {
        _ = try await Api.addPoints(state, entry)
      } catch ApiError.network {
        left.append(entry)
      } catch {
        // Rejected entries (game ended) are dropped.
      }
    }
    Store.setPending(left)
  }
}
