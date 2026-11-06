import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WidgetPreview, WidgetSteps } from './WidgetPreview';
import { Body, Button } from './ui';
import { colors, space } from './theme';

export function WidgetIntroModal({ visible, onClose, firstScore }: { visible: boolean; onClose: () => void; firstScore?: boolean }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {firstScore ? "Nice, that's your first point." : 'Score without opening the app'}
          </Text>
          <Body muted>
            {firstScore
              ? 'Next time, tap it straight from your home screen with the Contact 10 widget.'
              : 'Add the Contact 10 widget to your home screen and log points with one tap.'}
          </Body>
          <WidgetPreview />
          {showHow ? <WidgetSteps /> : <Button label="Show me how" variant="secondary" onPress={() => setShowHow(true)} />}
          <Button label={showHow ? 'Done' : 'Maybe later'} variant={showHow ? 'primary' : 'ghost'} onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 1.5 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
});
