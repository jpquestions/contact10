import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@firebase/auth';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Screen } from '../components/ui';
import { colors, radius, space } from '../components/theme';
import { auth } from '../lib/firebase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'signIn' | 'signUp';

function friendlyError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already uses that email. Sign in instead.';
    case 'auth/weak-password':
      return 'Use a password with at least 8 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your network and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const address = email.trim().toLowerCase();

  async function submit() {
    setError(null);
    setNotice(null);
    if (!EMAIL_PATTERN.test(address)) return setError('Enter a valid email address.');
    if (mode === 'signUp' && password.length < 8) return setError('Use a password with at least 8 characters.');
    setBusy(true);
    try {
      // On success the auth listener picks up the user and the router moves on.
      if (mode === 'signUp') await createUserWithEmailAndPassword(auth, address, password);
      else await signInWithEmailAndPassword(auth, address, password);
    } catch (err) {
      setError(friendlyError((err as { code?: string }).code));
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    setNotice(null);
    if (!EMAIL_PATTERN.test(address)) return setError('Enter your email above first.');
    try {
      await sendPasswordResetEmail(auth, address);
    } catch {
      // Same message either way so the form does not reveal who has an account.
    }
    setNotice(`If ${address} has an account, a reset link is on its way.`);
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>Contact 10</Text>
        <Body muted>Score points for every conversation. Play with friends. Hit your goals.</Body>
      </View>

      <Card>
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
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signUp' ? 'At least 8 characters' : 'Password'}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button label={mode === 'signUp' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Body muted>{notice}</Body>}
      </Card>

      <Button
        label={mode === 'signUp' ? 'I already have an account' : 'Create a new account'}
        variant="ghost"
        onPress={() => {
          setMode(mode === 'signUp' ? 'signIn' : 'signUp');
          setError(null);
          setNotice(null);
        }}
      />
      {mode === 'signIn' && <Button label="Forgot password" variant="ghost" onPress={resetPassword} />}
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
  error: { color: colors.danger, fontSize: 15 },
});
