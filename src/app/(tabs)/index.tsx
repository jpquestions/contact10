import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, ProgressBar, Screen } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { milestoneProgress } from '../../lib/milestones';

export default function Home() {
  const { profile, signOut } = useAuth();
  const points = profile?.lifetimePoints ?? 0;
  const progress = milestoneProgress(points);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.hello}>@{profile?.username}</Text>
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

      <Card>
        <Text style={styles.cardTitle}>Scoring and games</Text>
        <Body muted>Quick add buttons, games with friends and live leaderboards arrive in the next build.</Body>
      </Card>

      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.sm },
  hello: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  caption: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  total: { color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -1 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
