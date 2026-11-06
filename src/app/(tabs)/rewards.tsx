import { StyleSheet, Text, View } from 'react-native';
import { Body, Card, Screen, Title } from '../../components/ui';
import { colors, radius, space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { MILESTONES } from '../../lib/milestones';

export default function Rewards() {
  const { profile } = useAuth();
  const points = profile?.lifetime_points ?? 0;

  return (
    <Screen>
      <Title>Rewards</Title>
      <Body muted>Milestones on your lifetime points. Soon you can set your own reward for each one.</Body>
      <Card style={{ gap: space.sm }}>
        {MILESTONES.map((m) => {
          const reached = points >= m;
          return (
            <View key={m} style={styles.row} accessible accessibilityLabel={`${m} points, ${reached ? 'reached' : 'locked'}`}>
              <View style={[styles.dot, reached && styles.dotReached]} />
              <Text style={[styles.value, !reached && { color: colors.textMuted }]}>{m.toLocaleString()}</Text>
              <Text style={styles.state}>{reached ? 'Reached' : 'Locked'}</Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  dot: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border },
  dotReached: { backgroundColor: colors.success, borderColor: colors.success },
  value: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  state: { color: colors.textMuted, fontSize: 14 },
});
