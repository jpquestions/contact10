import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, ErrorText } from '../../components/controls';
import { Body, Button, Centered } from '../../components/ui';
import { colors, radius, space } from '../../components/theme';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { useEntry, useGame } from '../../lib/hooks';
import { MAX_ENTRY, MIN_ENTRY, QUICK_ADD } from '../../lib/rules';
import { canEditEntry } from '../../lib/types';

/** Change the amount of one of your own entries, or delete it. */
export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: entry, loading } = useEntry(id);
  const { data: game, loading: gameLoading } = useGame(entry?.gameId ?? undefined);
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading || (entry?.gameId && gameLoading)) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }
  if (!entry || entry.userId !== user?.uid) {
    return (
      <Centered>
        <Body muted>Entry not found.</Body>
      </Centered>
    );
  }

  const amount = value ?? entry.amount;
  const editable = canEditEntry(entry, game);
  const clamp = (n: number) => Math.min(MAX_ENTRY, Math.max(MIN_ENTRY, n));
  const where = entry.gameId ? (game?.name ?? 'a game') : 'Personal';

  async function run(kind: 'save' | 'delete') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'delete') await api.removePoints({ entryId: entry!.id });
      else await api.editPoints({ entryId: entry!.id, amount });
      router.back();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete points', `Remove these ${entry!.amount} points from ${where} and your lifetime total?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run('delete') },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Body muted>
        +{entry.amount} in {where}, {timeAgo(entry.createdAt)}.
        {entry.editedAt && entry.originalAmount !== undefined ? ` Edited from ${entry.originalAmount}.` : ''}
      </Body>
      {!editable ? (
        <Body muted>
          This entry can no longer be changed. You can edit or delete your own points for 24 hours while the game is live, as long as they have not been
          flagged.
        </Body>
      ) : (
        <>
          <View style={styles.stepper}>
            {[-10, -1].map((d) => (
              <Pressable key={d} onPress={() => setValue(clamp(amount + d))} style={styles.step} accessibilityRole="button" accessibilityLabel={`Minus ${-d}`}>
                <Text style={styles.stepText}>{d}</Text>
              </Pressable>
            ))}
            <Text style={styles.value} accessibilityLiveRegion="polite">
              {amount}
            </Text>
            {[1, 10].map((d) => (
              <Pressable key={d} onPress={() => setValue(clamp(amount + d))} style={styles.step} accessibilityRole="button" accessibilityLabel={`Plus ${d}`}>
                <Text style={styles.stepText}>+{d}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chips}>
            {QUICK_ADD.map((n) => (
              <Chip key={n} label={String(n)} on={amount === n} onPress={() => setValue(n)} />
            ))}
          </View>
          <Body muted style={{ fontSize: 13 }}>
            Your game and lifetime totals update to match. Edits show in the game's activity.
          </Body>
          <ErrorText>{error}</ErrorText>
          <Button label={`Save as ${amount}`} onPress={() => run('save')} loading={busy === 'save'} disabled={busy !== null || amount === entry.amount} />
          <Button label="Delete these points" variant="ghost" onPress={confirmDelete} loading={busy === 'delete'} disabled={busy !== null} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  step: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  value: { color: colors.text, fontSize: 48, fontWeight: '900', minWidth: 100, textAlign: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
});
