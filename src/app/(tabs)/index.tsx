import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionTitle } from '../../components/controls';
import { GameCard } from '../../components/GameCard';
import { InviteList } from '../../components/InviteList';
import { ScorePanel } from '../../components/ScorePanel';
import { Body, Button, Card, ProgressBar, Screen } from '../../components/ui';
import { colors, radius, space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { useMyGames, useNotifications } from '../../lib/hooks';
import { milestoneProgress } from '../../lib/milestones';
import { isLive } from '../../lib/types';

export default function Home() {
  const { user, profile, updateProfile } = useAuth();
  const { data: games } = useMyGames();
  const { data: notes } = useNotifications();
  const unread = notes.filter((n) => !n.readAt).length;
  const points = profile?.lifetimePoints ?? 0;
  const progress = milestoneProgress(points);
  const live = games.filter((g) => isLive(g));
  const selected = live.some((g) => g.id === profile?.activeGameId) ? profile!.activeGameId : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.hello}>@{profile?.username}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton name="notifications-outline" label={`Notifications, ${unread} unread`} badge={unread} onPress={() => router.push('/notifications')} />
          <IconButton name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <Card>
        <Text style={styles.caption}>Lifetime points</Text>
        <Text style={styles.total}>{points.toLocaleString()}</Text>
        {progress.next !== null ? (
          <>
            <ProgressBar fraction={progress.fraction} />
            <Body muted>
              {(progress.next - points).toLocaleString()} to your {progress.next.toLocaleString()} milestone
            </Body>
          </>
        ) : (
          <Body muted>Every milestone reached.</Body>
        )}
      </Card>

      <ScorePanel
        games={live.map((g) => ({ id: g.id, name: g.name }))}
        selected={selected}
        onSelect={(id) => updateProfile({ activeGameId: id })}
      />

      <InviteList />

      <SectionTitle>Live games</SectionTitle>
      {live.length === 0 ? (
        <Body muted>No live games. Start one and invite your friends.</Body>
      ) : (
        live.map((g) => <GameCard key={g.id} game={g} uid={user!.uid} />)
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="New game" onPress={() => router.push('/game/new')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Join with code" variant="secondary" onPress={() => router.push('/join/enter')} />
        </View>
      </View>
    </Screen>
  );
}

function IconButton({
  name,
  label,
  onPress,
  badge = 0,
}: {
  name: 'notifications-outline' | 'settings-outline';
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={styles.iconButton}>
      <Ionicons name={name} size={22} color={colors.text} />
      {badge > 0 && (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  total: { color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -1 },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: colors.accentText, fontSize: 11, fontWeight: '800' },
});
