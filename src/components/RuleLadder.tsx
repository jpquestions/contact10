import { StyleSheet, Text, View } from 'react-native';
import { RULE_STEPS } from '../lib/rules';
import { colors, radius, space } from './theme';

export function RuleLadder() {
  return (
    <View style={{ gap: space.sm }}>
      {RULE_STEPS.map((step, i) => (
        <View key={step.label} style={styles.row} accessible accessibilityLabel={`${step.label}, ${step.points} points, ${step.total} total`}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{step.points}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{step.label}</Text>
            {i > 0 && <Text style={styles.total}>{step.total} total</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.accentText, fontSize: 18, fontWeight: '800' },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  total: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
