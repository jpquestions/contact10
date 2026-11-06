import { Modal, StyleSheet, Text, View } from 'react-native';
import { Body, Button } from './ui';
import { colors, radius, space } from './theme';

export type Celebration = { title: string; subtitle: string; reward: string | null };

export function CelebrationModal({ item, onClose }: { item: Celebration | null; onClose: () => void }) {
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {item && (
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.burst}>10</Text>
            <Text style={styles.title} accessibilityRole="header">
              {item.title}
            </Text>
            <Body muted style={{ textAlign: 'center' }}>
              {item.subtitle}
            </Body>
            {item.reward && (
              <View style={styles.reward}>
                <Text style={styles.rewardLabel}>Your reward</Text>
                <Text style={styles.rewardText}>{item.reward}</Text>
              </View>
            )}
            <Button label="Let's go" onPress={onClose} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: space.xl },
  card: { backgroundColor: colors.surface, borderRadius: 28, padding: space.xl, gap: space.md, alignItems: 'stretch' },
  burst: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    color: colors.accentText,
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 88,
    overflow: 'hidden',
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  reward: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  rewardLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  rewardText: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
