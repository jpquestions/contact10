import { Platform, StyleSheet, Text, View } from 'react-native';
import { QUICK_ADD } from '../lib/rules';
import { colors, radius, space } from './theme';
import { Body } from './ui';

/** A static picture of the Quick Add home screen widget. */
export function WidgetPreview({ gameName = 'Friday Night', points = 16 }: { gameName?: string; points?: number }) {
  return (
    <View style={styles.widget} accessible accessibilityLabel="Preview of the Quick Add widget">
      <View style={styles.header}>
        <Text style={styles.game} numberOfLines={1}>{gameName}</Text>
        <Text style={styles.points}>{points} pts</Text>
      </View>
      <View style={styles.buttons}>
        {QUICK_ADD.map((n) => (
          <View key={n} style={styles.button}>
            <Text style={styles.buttonText}>+{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Platform specific steps for adding the widget to the home screen. */
export function WidgetSteps() {
  const steps =
    Platform.OS === 'android'
      ? ['Touch and hold an empty spot on your home screen.', 'Tap Widgets.', 'Find Contact 10 and drag the Quick Add widget onto your screen.']
      : ['Touch and hold an empty spot on your home screen until the apps jiggle.', 'Tap Edit, then Add Widget.', 'Search for Contact 10, pick Quick Add, and tap Add Widget.'];
  return (
    <>
      {steps.map((s, i) => (
        <Body key={s}>
          {i + 1}. {s}
        </Body>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 22,
    padding: space.lg,
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  game: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  points: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: space.sm },
  button: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '800' },
});
