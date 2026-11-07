import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { MAX_ENTRY, MIN_ENTRY, QUICK_ADD } from '../lib/rules';
import type { Entry } from '../lib/types';
import { Chip, ErrorText, Sheet } from './controls';
import { Body, Button } from './ui';
import { colors, radius, space } from './theme';

/** Change the amount of one of your own entries, or delete it. */
export function EditEntrySheet({ entry, gameName, onClose }: { entry: Entry | null; gameName?: string | null; onClose: () => void }) {
  const [value, setValue] = useState(1);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if ((entry?.id ?? null) !== openedFor) {
    setOpenedFor(entry?.id ?? null);
    setValue(entry?.amount ?? 1);
    setError(null);
  }

  const clamp = (n: number) => Math.min(MAX_ENTRY, Math.max(MIN_ENTRY, n));

  async function run(kind: 'save' | 'delete') {
    if (!entry) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'delete') await api.removePoints({ entryId: entry.id });
      else await api.editPoints({ entryId: entry.id, amount: value });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={entry !== null} onClose={onClose}>
      <Text style={styles.title}>Edit points</Text>
      <Body muted>
        {gameName ? `In ${gameName}. ` : 'Solo points. '}You can fix or delete your own points for 24 hours while the game is live. Edits show in the
        game's activity.
      </Body>
      <View style={styles.stepper}>
        {[-10, -1].map((d) => (
          <Pressable key={d} onPress={() => setValue((v) => clamp(v + d))} style={styles.step} accessibilityRole="button" accessibilityLabel={`Minus ${-d}`}>
            <Text style={styles.stepText}>{d}</Text>
          </Pressable>
        ))}
        <Text style={styles.value} accessibilityLiveRegion="polite">
          {value}
        </Text>
        {[1, 10].map((d) => (
          <Pressable key={d} onPress={() => setValue((v) => clamp(v + d))} style={styles.step} accessibilityRole="button" accessibilityLabel={`Plus ${d}`}>
            <Text style={styles.stepText}>+{d}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {QUICK_ADD.map((n) => (
          <Chip key={n} label={String(n)} on={value === n} onPress={() => setValue(n)} />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button label="Save" onPress={() => run('save')} loading={busy === 'save'} disabled={busy !== null || value === entry?.amount} />
      <Button label="Delete these points" variant="ghost" onPress={() => run('delete')} loading={busy === 'delete'} disabled={busy !== null} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  step: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  value: { color: colors.text, fontSize: 44, fontWeight: '900', minWidth: 90, textAlign: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
});
