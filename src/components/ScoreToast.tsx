import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from './theme';

export type ToastState = {
  key: string;
  amount: number;
  gameName: string | null;
  status: 'saving' | 'saved' | 'queued' | 'undoing' | 'undone' | 'error';
  entryId?: string;
  message?: string;
};

const UNDO_WINDOW_MS = 10_000;

export function ScoreToast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: ToastState | null;
  onUndo: (entryId: string) => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast || toast.status === 'saving' || toast.status === 'undoing') return;
    const t = setTimeout(onDismiss, toast.status === 'saved' ? UNDO_WINDOW_MS : 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const where = toast.gameName ? ` in ${toast.gameName}` : '';
  const text = {
    saving: `+${toast.amount}${where}`,
    saved: `+${toast.amount}${where}`,
    queued: `+${toast.amount} saved offline. It will sync when you reconnect.`,
    undoing: 'Undoing...',
    undone: `Removed ${toast.amount} points`,
    error: toast.message ?? 'Could not save points.',
  }[toast.status];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 70 }]}>
      <View style={[styles.toast, toast.status === 'error' && { borderColor: colors.danger }]} accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
        {toast.status === 'saved' && toast.entryId && (
          <Pressable onPress={() => onUndo(toast.entryId!)} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.undo}>Undo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  undo: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
