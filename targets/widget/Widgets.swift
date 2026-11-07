import AppIntents
import SwiftUI
import WidgetKit

struct ScoreEntry: TimelineEntry {
  let date: Date
  let state: SharedState?
  let target: Target
  let error: String?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> ScoreEntry {
    let game = SharedState.Game(
      id: "demo", name: "Friday Night", points: 16,
      leaders: [.init(username: "sam", points: 22), .init(username: "you", points: 16), .init(username: "alex", points: 9)]
    )
    let state = SharedState(
      refreshToken: "", apiKey: "", functionsBase: "", username: "you", lifetimePoints: 64,
      activeGameId: "demo", games: [game]
    )
    return ScoreEntry(date: Date(), state: state, target: .game(game), error: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ScoreEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : current())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ScoreEntry>) -> Void) {
    completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(30 * 60))))
  }

  private func current() -> ScoreEntry {
    let state = Store.load()
    return ScoreEntry(
      date: Date(),
      state: state,
      target: state?.target(chosen: Store.chosenTarget) ?? .solo,
      error: Store.defaults?.string(forKey: "lastError")
    )
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

/// The target name. Tapping it switches between live games and Personal.
struct TargetHeader: View {
  let state: SharedState
  let target: Target

  var body: some View {
    HStack(alignment: .center) {
      Button(intent: CycleTargetIntent()) {
        HStack(spacing: 4) {
          Text(target.label)
            .font(.system(size: 14, weight: .bold))
            .lineLimit(1)
          Image(systemName: "arrow.left.arrow.right")
            .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(surface, in: Capsule())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Adding to \(target.label). Tap to switch.")
      Spacer()
      Text("\(state.points(for: target)) pts")
        .font(.system(size: 15, weight: .heavy, design: .rounded))
        .foregroundStyle(accent)
        .contentTransition(.numericText())
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
        TargetHeader(state: state, target: entry.target)
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
        TargetHeader(state: state, target: entry.target)
        switch entry.target {
        case .solo:
          Text("Personal points count toward your lifetime total. Tap the name above to pick a game.")
            .font(.caption)
            .foregroundStyle(muted)
        case .game(let game):
          ForEach(Array(game.leaders.prefix(5).enumerated()), id: \.offset) { index, leader in
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
    .description("Log points with one tap. Tap the name to switch between games and Personal.")
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
    .description("The top five in a game, with quick add.")
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
