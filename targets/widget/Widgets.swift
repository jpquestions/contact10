import AppIntents
import SwiftUI
import WidgetKit

struct ScoreEntry: TimelineEntry {
  let date: Date
  let state: SharedState?
  let error: String?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> ScoreEntry {
    ScoreEntry(date: Date(), state: SharedState(
      refreshToken: "", apiKey: "", functionsBase: "", username: "you", lifetimePoints: 64,
      activeGameId: "demo", activeGameName: "Friday Night", gamePoints: 16,
      leaders: [.init(username: "sam", points: 22), .init(username: "you", points: 16), .init(username: "alex", points: 9)]
    ), error: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ScoreEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : current())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ScoreEntry>) -> Void) {
    completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(30 * 60))))
  }

  private func current() -> ScoreEntry {
    ScoreEntry(date: Date(), state: Store.load(), error: Store.defaults?.string(forKey: "lastError"))
  }
}

// MARK: Views

private let accent = Color("$accent")
private let surface = Color("surface")
private let muted = Color("muted")

struct QuickAddButtons: View {
  var body: some View {
    HStack(spacing: 6) {
      ForEach(quickAdd, id: \.self) { n in
        Button(intent: AddPointsIntent(amount: n)) {
          Text("+\(n)")
            .font(.system(size: 16, weight: .heavy, design: .rounded))
            .frame(maxWidth: .infinity, minHeight: 40)
            .foregroundStyle(.white)
            .background(accent, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add \(n) points")
      }
    }
  }
}

struct SignedOutView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Contact 10").font(.headline).foregroundStyle(.white)
      Text("Open the app to sign in.").font(.caption).foregroundStyle(muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct QuickAddView: View {
  let entry: ScoreEntry

  var body: some View {
    if let state = entry.state {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .firstTextBaseline) {
          Text(state.activeGameName ?? "Solo")
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
          Spacer()
          Text("\(state.gamePoints ?? state.lifetimePoints) pts")
            .font(.system(size: 15, weight: .heavy, design: .rounded))
            .foregroundStyle(accent)
            .contentTransition(.numericText())
        }
        if let error = entry.error {
          Text(error).font(.caption2).foregroundStyle(muted).lineLimit(1)
        }
        Spacer(minLength: 0)
        QuickAddButtons()
      }
    } else {
      SignedOutView()
    }
  }
}

struct ScoreView: View {
  let entry: ScoreEntry

  var body: some View {
    if let state = entry.state {
      let progress = nextMilestone(after: state.lifetimePoints)
      VStack(alignment: .leading, spacing: 6) {
        Text("Lifetime").font(.caption).bold().foregroundStyle(muted)
        Text("\(state.lifetimePoints)")
          .font(.system(size: 40, weight: .black, design: .rounded))
          .foregroundStyle(.white)
          .minimumScaleFactor(0.5)
          .contentTransition(.numericText())
        Spacer(minLength: 0)
        if let next = progress.next {
          ProgressView(value: Double(state.lifetimePoints - progress.floor), total: Double(next - progress.floor))
            .tint(accent)
          Text("\(next - state.lifetimePoints) to \(next)").font(.caption2).foregroundStyle(muted)
        } else {
          Text("Every milestone reached").font(.caption2).foregroundStyle(muted)
        }
      }
    } else {
      SignedOutView()
    }
  }
}

struct LeaderboardView: View {
  let entry: ScoreEntry

  var body: some View {
    if let state = entry.state {
      VStack(alignment: .leading, spacing: 10) {
        Text(state.activeGameName ?? "No active game")
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(.white)
        if state.leaders.isEmpty {
          Text("Open a game in the app to see its leaderboard here.").font(.caption).foregroundStyle(muted)
        }
        ForEach(Array(state.leaders.prefix(5).enumerated()), id: \.offset) { index, leader in
          HStack {
            Text("\(index + 1)").font(.subheadline.bold()).foregroundStyle(muted).frame(width: 18)
            Text("@\(leader.username)")
              .font(.subheadline.bold())
              .foregroundStyle(leader.username == state.username ? accent : .white)
              .lineLimit(1)
            Spacer()
            Text("\(leader.points)").font(.system(.headline, design: .rounded)).foregroundStyle(.white)
          }
        }
        Spacer(minLength: 0)
        QuickAddButtons()
      }
    } else {
      SignedOutView()
    }
  }
}

// MARK: Widgets

private extension View {
  func contact10Background() -> some View {
    containerBackground(Color("$widgetBackground"), for: .widget)
  }
}

struct QuickAddWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "QuickAdd", provider: Provider()) { entry in
      QuickAddView(entry: entry).contact10Background().widgetURL(URL(string: "contact10://"))
    }
    .configurationDisplayName("Quick Add")
    .description("Log points to your active game with one tap.")
    .supportedFamilies([.systemMedium])
  }
}

struct ScoreWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "Score", provider: Provider()) { entry in
      ScoreView(entry: entry).contact10Background().widgetURL(URL(string: "contact10://"))
    }
    .configurationDisplayName("Score")
    .description("Your lifetime points and next milestone.")
    .supportedFamilies([.systemSmall])
  }
}

struct LeaderboardWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "Leaderboard", provider: Provider()) { entry in
      LeaderboardView(entry: entry).contact10Background().widgetURL(URL(string: "contact10://"))
    }
    .configurationDisplayName("Leaderboard")
    .description("The top five in your active game, with quick add.")
    .supportedFamilies([.systemLarge])
  }
}

@main
struct Contact10Widgets: WidgetBundle {
  var body: some Widget {
    QuickAddWidget()
    ScoreWidget()
    LeaderboardWidget()
  }
}
