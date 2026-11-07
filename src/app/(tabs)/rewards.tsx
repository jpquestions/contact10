import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Row } from '../../components/controls';
import { Body, Card, ProgressBar, Screen, Title } from '../../components/ui';
import { colors, radius, space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { useRewards, useUnlocks } from '../../lib/hooks';
import { MILESTONES, milestoneProgress } from '../../lib/milestones';

export default function Rewards() {
  const { user, profile } = useAuth();
  const uid = user!.uid;
  const points = profile?.lifetimePoints ?? 0;
  const { data: rewards } = useRewards();
  const { data: unlocks } = useUnlocks(uid);
  const progress = milestoneProgress(points);
  const rewardFor = (m: number) => rewards.find((r) => r.id === String(m))?.rewardText ?? null;
  const reachedOn = (m: number) => unlocks.find((u) => u.id === String(m))?.reachedAt?.toDate() ?? null;

  return (
    <Screen>
      <Title>Rewards</Title>
      <Body muted>Pick a reward for yourself at each milestone on your lifetime points: new shoes at 500, a trip at 5,000. Tap any milestone to set its reward.</Body>
      {progress.next !== null && (
        <Card>
          <Body>
            {points.toLocaleString()} of {progress.next.toLocaleString()}
          </Body>
          <ProgressBar fraction={progress.fraction} />
          {rewardFor(progress.next) && <Body muted>Next up: {rewardFor(progress.next)}</Body>}
        </Card>
      )}
      <Card style={{ gap: 0 }}>
        {MILESTONES.map((m) => {
          const reached = points >= m;
          const date = reachedOn(m);
          const reward = rewardFor(m);
          return (
            <Row key={m} onPress={() => router.push(`/reward/${m}`)} accessibilityLabel={`${m} points, ${reached ? 'reached' : 'locked'}${reward ? `, reward ${reward}` : ''}`}>
              <View style={[styles.dot, reached && styles.dotReached]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, !reached && { color: colors.textMuted }]}>{m.toLocaleString()}</Text>
                <Text style={styles.reward} numberOfLines={2}>
                  {reward ?? 'Add a reward'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{reward ? 'Edit' : 'Set'}</Text>
                </View>
                <Text style={styles.state}>{reached ? (date ? date.toLocaleDateString() : 'Reached') : 'Locked'}</Text>
              </View>
            </Row>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border },
  dotReached: { backgroundColor: colors.success, borderColor: colors.success },
  value: { color: colors.text, fontSize: 18, fontWeight: '800' },
  reward: { color: colors.textMuted, fontSize: 14 },
  state: { color: colors.textMuted, fontSize: 12 },
  pill: { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
