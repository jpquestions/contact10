import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MAX_ENTRY, MIN_ENTRY, QUICK_ADD } from '../lib/rules';
import { useScoring } from '../lib/scoring';
import { Chip, Sheet } from './controls';
import { Body, Button, Card } from './ui';
import { colors, radius, space } from './theme';

type GameOption = { id: string; name: string };

/**
 * Quick add buttons plus a custom amount. With `games`, shows a picker so
 * points can go to any live game or to solo play.
 */
export function ScorePanel({
  games,
  fixedGame,
  selected,
  onSelect,
}: {
  games?: GameOption[];
  fixedGame?: GameOption;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const { score } = useScoring();
  const [custom, setCustom] = useState(false);

  const target = fixedGame ?? games?.find((g) => g.id === selected) ?? null;
  const add = (n: number) => score(n, target?.id ?? null, target?.name ?? null);

  return (
    <Card>
      <Text style={styles.heading}>Add points</Text>
      {games && onSelect && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {games.map((g) => (
            <Chip key={g.id} label={g.name} on={selected === g.id} onPress={() => onSelect(g.id)} />
          ))}
          <Chip label="No game" on={!target} onPress={() => onSelect(null)} />
        </ScrollView>
      )}
      <View style={styles.buttons}>
        {QUICK_ADD.map((n) => (
          <Pressable
            key={n}
            onPress={() => add(n)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${n} point${n === 1 ? '' : 's'}${target ? ` to ${target.name}` : ''}`}
            style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
          >
            <Text style={styles.quickText}>+{n}</Text>
          </Pressable>
        ))}
      </View>
      <Button label="Custom amount" variant="secondary" onPress={() => setCustom(true)} />
      <CustomAmount
        visible={custom}
        onClose={() => setCustom(false)}
        onAdd={(n) => {
          setCustom(false);
          add(n);
        }}
        target={target?.name ?? null}
      />
    </Card>
  );
}

function CustomAmount({
  visible,
  onClose,
  onAdd,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (n: number) => void;
  target: string | null;
}) {
  const [value, setValue] = useState(5);
  const clamp = (n: number) => Math.min(MAX_ENTRY, Math.max(MIN_ENTRY, n));
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.heading}>Custom amount</Text>
      <Body muted>{target ? `Adds to ${target}.` : 'Solo points: counts toward your lifetime total.'}</Body>
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
      <Body muted style={{ textAlign: 'center' }}>
        {MIN_ENTRY} to {MAX_ENTRY} points
      </Body>
      <Button label={`Add ${value}`} onPress={() => onAdd(value)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: space.sm },
  quick: { flex: 1, height: 58, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  quickText: { color: colors.accentText, fontSize: 20, fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  step: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  value: { color: colors.text, fontSize: 44, fontWeight: '900', minWidth: 90, textAlign: 'center' },
});
