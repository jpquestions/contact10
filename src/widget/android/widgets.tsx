import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { QUICK_ADD } from '../../lib/rules';
import { MILESTONES } from '../../lib/milestones';
import { targetLabel, targetPoints, type WidgetState, type WidgetTarget } from '../core';

const C = {
  bg: '#0E0F13',
  surface: '#22252E',
  text: '#F4F5F7',
  muted: '#9AA0AC',
  accent: '#FF5A36',
  white: '#FFFFFF',
} as const;

type Props = { state: WidgetState | null; target: WidgetTarget; error: string | null };

function Root({ children, open = false }: { children: React.ReactNode; open?: boolean }) {
  return (
    <FlexWidget
      clickAction={open ? 'OPEN_APP' : undefined}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 22,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </FlexWidget>
  );
}

function SignedOut() {
  return (
    <Root open>
      <TextWidget text="Contact 10" style={{ fontSize: 16, fontWeight: 'bold', color: C.text }} />
      <TextWidget text="Open the app to sign in." style={{ fontSize: 13, color: C.muted }} />
    </Root>
  );
}

/** The tappable target name. Tapping cycles through live games and Personal. */
function TargetHeader({ state, target }: { state: WidgetState; target: WidgetTarget }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
      <FlexWidget
        clickAction="CYCLE"
        accessibilityLabel={`Adding to ${targetLabel(target)}. Tap to switch.`}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}
      >
        <TextWidget text={`${targetLabel(target)}  ⇄`} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: 'bold', color: C.text }} />
      </FlexWidget>
      <TextWidget text={`${targetPoints(state, target)} pts`} style={{ fontSize: 15, fontWeight: '900', color: C.accent }} />
    </FlexWidget>
  );
}

function QuickButtons() {
  return (
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', flexGap: 6 }}>
      {QUICK_ADD.map((n) => (
        <FlexWidget
          key={n}
          clickAction="ADD"
          clickActionData={{ amount: n }}
          accessibilityLabel={`Add ${n} points`}
          style={{ flex: 1, height: 42, backgroundColor: C.accent, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
        >
          <TextWidget text={`+${n}`} style={{ fontSize: 16, fontWeight: '900', color: C.white }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

export function QuickAddWidget({ state, target, error }: Props) {
  if (!state) return <SignedOut />;
  return (
    <Root>
      <TargetHeader state={state} target={target} />
      {error ? <TextWidget text={error} maxLines={1} truncate="END" style={{ fontSize: 11, color: C.muted }} /> : null}
      <QuickButtons />
    </Root>
  );
}

export function ScoreWidget({ state }: Props) {
  if (!state) return <SignedOut />;
  const pts = state.lifetimePoints;
  const next = MILESTONES.find((m) => pts < m) ?? null;
  return (
    <Root open>
      <TextWidget text="Lifetime" style={{ fontSize: 12, fontWeight: 'bold', color: C.muted }} />
      <TextWidget text={pts.toLocaleString('en-US')} style={{ fontSize: 38, fontWeight: '900', color: C.text, adjustsFontSizeToFit: true }} />
      <TextWidget
        text={next ? `${next - pts} to ${next.toLocaleString('en-US')}` : 'Every milestone reached'}
        style={{ fontSize: 12, color: C.muted }}
      />
    </Root>
  );
}

export function LeaderboardWidget({ state, target, error }: Props) {
  if (!state) return <SignedOut />;
  const leaders = target.kind === 'game' ? target.game.leaders.slice(0, 5) : [];
  return (
    <Root>
      <TargetHeader state={state} target={target} />
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 6, flex: 1, paddingVertical: 10 }}>
        {target.kind === 'solo' ? (
          <TextWidget text="Personal points count toward your lifetime total. Tap the name above to pick a game." style={{ fontSize: 13, color: C.muted }} />
        ) : (
          leaders.map((l, i) => (
            <FlexWidget key={l.username} style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
              <TextWidget
                text={`${i + 1}  @${l.username}`}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 14, fontWeight: 'bold', color: l.username === state.username ? C.accent : C.text }}
              />
              <TextWidget text={String(l.points)} style={{ fontSize: 15, fontWeight: '900', color: C.text }} />
            </FlexWidget>
          ))
        )}
        {error ? <TextWidget text={error} maxLines={1} truncate="END" style={{ fontSize: 11, color: C.muted }} /> : null}
      </FlexWidget>
      <QuickButtons />
    </Root>
  );
}

export const ANDROID_WIDGETS = { QuickAdd: QuickAddWidget, Score: ScoreWidget, Leaderboard: LeaderboardWidget } as const;
export type AndroidWidgetName = keyof typeof ANDROID_WIDGETS;

export function renderAndroidWidget(name: string, props: Props) {
  const Widget = ANDROID_WIDGETS[name as AndroidWidgetName] ?? QuickAddWidget;
  return <Widget {...props} />;
}
