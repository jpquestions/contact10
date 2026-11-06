import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Screen } from '../components/ui';
import { colors, radius, space } from '../components/theme';
import { supabase } from '../lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) setError(err.message);
    else setSentTo(address);
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the auth listener updates the session and the router moves on.
    if (err) setError('That code did not work. Check it or send a new one.');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>Contact 10</Text>
        <Body muted>Score points for every conversation. Play with friends. Hit your goals.</Body>
      </View>

      <Card>
        {sentTo === null ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
            <Button label="Send sign in code" onPress={sendCode} loading={busy} />
          </>
        ) : (
          <>
            <Body muted>We sent a code to {sentTo}.</Body>
            <TextInput
              style={[styles.input, styles.code]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="Code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={verify}
            />
            <Button label="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            <Button
              label="Use a different email"
              variant="ghost"
              onPress={() => {
                setSentTo(null);
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: space.xxl * 2, marginBottom: space.lg, gap: space.sm },
  logo: { color: colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 52,
    fontSize: 17,
  },
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 15 },
});
