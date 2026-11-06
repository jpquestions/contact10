import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { Body, Centered, Title } from '../components/ui';
import { colors } from '../components/theme';
import { AuthProvider, useAuth } from '../lib/auth';
import { isConfigured } from '../lib/supabase';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      {isConfigured ? <RootNavigator /> : <NotConfigured />}
    </AuthProvider>
  );
}

function RootNavigator() {
  const { ready, session, profile } = useAuth();

  if (!ready) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }

  const signedIn = session !== null;
  // Onboarding runs until a username is picked and the widget intro is seen.
  const onboarded = Boolean(profile?.username && profile.seen_widget_intro_launch);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

function NotConfigured() {
  return (
    <Centered>
      <Title>Contact 10</Title>
      <Body muted style={{ textAlign: 'center' }}>
        Supabase is not configured. Copy .env.example to .env, fill in the project URL and publishable key, then
        restart the dev server.
      </Body>
    </Centered>
  );
}
