import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { ErrorText, Field, Row, SectionTitle } from '../components/controls';
import { WidgetIntroModal } from '../components/WidgetIntroModal';
import { Body, Button, Card, Screen } from '../components/ui';
import { colors } from '../components/theme';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { NotificationPrefs } from '../lib/types';

const PREFS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'invites', label: 'Game invites' },
  { key: 'friendRequests', label: 'Friend requests' },
  { key: 'friendMilestones', label: 'Friends hitting milestones' },
  { key: 'gameTargets', label: 'Game targets and winners' },
  { key: 'gameEnding', label: 'Games ending' },
  { key: 'flags', label: 'Flags and decisions' },
];

export default function Settings() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [saved, setSaved] = useState(false);
  const [widgetHelp, setWidgetHelp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefs = profile?.notificationPrefs ?? {};

  function toggle(key: keyof NotificationPrefs, on: boolean) {
    updateProfile({ notificationPrefs: { ...prefs, [key]: on } });
  }

  function confirmDelete() {
    Alert.alert('Delete account', 'This permanently deletes your account, points, rewards and friends. Games you created are ended. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await api.deleteAccount({});
            await signOut();
          } catch (err) {
            setError(errorMessage(err));
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen header>
      <Card>
        <Body muted>
          Signed in as @{profile?.username} ({user?.email})
        </Body>
        <Field label="Display name" value={name} onChangeText={(t) => { setName(t); setSaved(false); }} maxLength={40} placeholder="Optional" />
        <Button
          label={saved ? 'Saved' : 'Save'}
          variant="secondary"
          onPress={async () => {
            const { error: err } = await updateProfile({ displayName: name.trim() || null });
            setSaved(!err);
          }}
        />
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card style={{ gap: 0 }}>
        {PREFS.map((p) => (
          <Row key={p.key}>
            <Text style={styles.label}>{p.label}</Text>
            <Switch
              value={prefs[p.key] !== false}
              onValueChange={(on) => toggle(p.key, on)}
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
              accessibilityLabel={p.label}
            />
          </Row>
        ))}
      </Card>

      <SectionTitle>More</SectionTitle>
      <Button label="Add the home screen widget" variant="secondary" onPress={() => setWidgetHelp(true)} />
      <Button label="Rules" variant="secondary" onPress={() => router.push('/rules')} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
      <View style={{ height: 12 }} />
      <Button label="Delete account" variant="ghost" onPress={confirmDelete} loading={deleting} />
      <ErrorText>{error}</ErrorText>
      <WidgetIntroModal visible={widgetHelp} onClose={() => setWidgetHelp(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 16, flex: 1 },
});
