import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { RuleLadder } from '../components/RuleLadder';
import { WidgetPreview, WidgetSteps } from '../components/WidgetPreview';
import { Body, Button, Card, Screen, Title } from '../components/ui';
import { colors, radius, space } from '../components/theme';
import { useAuth } from '../lib/auth';
import { USERNAME_PATTERN } from '../lib/types';

type Step = 'username' | 'scoring' | 'widget';

export default function Onboarding() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>(profile?.username ? 'scoring' : 'username');

  if (step === 'username') return <UsernameStep onDone={() => setStep('scoring')} />;
  if (step === 'scoring') return <ScoringStep onDone={() => setStep('widget')} />;
  return <WidgetStep />;
}

function UsernameStep({ onDone }: { onDone: () => void }) {
  const { claimUsername, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const username = name.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      setError('Use 3 to 20 lowercase letters, numbers or underscores.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err, code } = await claimUsername(username);
    setBusy(false);
    if (!err) onDone();
    else if (code === 'functions/already-exists') setError('That username is taken.');
    else setError(err);
  }

  return (
    <Screen>
      <Title>Pick a username</Title>
      <Body muted>Friends find you by this. It is the only thing people outside your friends and games can see.</Body>
      <Card>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => setName(t.toLowerCase())}
          placeholder="username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Button label="Continue" onPress={save} loading={busy} />
        {error && <Text style={styles.error}>{error}</Text>}
      </Card>
      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

function ScoringStep({ onDone }: { onDone: () => void }) {
  return (
    <Screen>
      <Title>How scoring works</Title>
      <Body muted>Every approach earns points. Go all the way and it is a full contact: 10 points.</Body>
      <Card>
        <RuleLadder />
      </Card>
      <Body muted>
        Play solo or join a game with friends. Game points also count toward your lifetime total, and every milestone
        can unlock a reward you set for yourself.
      </Body>
      <Button label="Continue" onPress={onDone} />
    </Screen>
  );
}

function WidgetStep() {
  const { updateProfile } = useAuth();
  const [showHow, setShowHow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    // Flipping this flag ends onboarding; the root guard moves to the tabs.
    const { error } = await updateProfile({ seenWidgetIntroLaunch: true });
    if (error) setBusy(false);
  }

  return (
    <Screen>
      <Title>Score without opening the app</Title>
      <Body muted>Add the Contact 10 widget to your home screen and log points with one tap, right after the moment.</Body>
      <WidgetPreview />
      {showHow ? (
        <Card>
          <WidgetSteps />
        </Card>
      ) : (
        <Button label="Show me how" variant="secondary" onPress={() => setShowHow(true)} />
      )}
      <Button label="Let's go" onPress={finish} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 52,
    fontSize: 18,
  },
  error: { color: colors.danger, fontSize: 15 },
});
