import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { gameStatusLine, GAME_TYPE_LABEL } from '../lib/format';
import type { Game } from '../lib/types';
import { Badge } from './controls';
import { colors, radius, space } from './theme';

export function GameCard({ game, uid }: { game: Game; uid: string }) {
  const won = game.winnerId === uid;
  return (
    <Pressable
      onPress={() => router.push(`/game/${game.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${game.name}, ${gameStatusLine(game)}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {game.name}
        </Text>
        <Text style={styles.meta}>
          {GAME_TYPE_LABEL[game.type]} · {gameStatusLine(game)} · {game.memberIds.length} playing
        </Text>
      </View>
      {won && <Badge label="Won" tone="success" />}
      {game.status === 'ended' && !won && <Badge label="Ended" />}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 14 },
  chevron: { color: colors.textMuted, fontSize: 26, marginTop: -2 },
});
