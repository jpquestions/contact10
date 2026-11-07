import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { Body, Centered, Title } from '../components/ui';
import { colors } from '../components/theme';
import { AppServices } from '../lib/AppServices';
import { AuthProvider, useAuth } from '../lib/auth';
import { isConfigured } from '../lib/firebase';
import { ScoringProvider } from '../lib/scoring';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      {isConfigured ? <RootNavigator /> : <NotConfigured />}
    </AuthProvider>
  );
}

const modal = { presentation: 'modal' as const, headerShown: true, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text };
const pushed = { headerShown: true, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerBackTitle: 'Back', title: '' };

function RootNavigator() {
  const { ready, user, profile } = useAuth();

  if (!ready) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }

  const signedIn = user !== null;
  // Onboarding runs until a username is picked and the widget intro is seen.
  const onboarded = Boolean(profile?.username && profile.seenWidgetIntroLaunch);

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={pushed} />
        <Stack.Screen name="game/new" options={{ ...modal, title: 'New game' }} />
        <Stack.Screen name="join/[code]" options={{ ...modal, title: 'Join game' }} />
        <Stack.Screen name="reward/[threshold]" options={{ ...modal, title: 'Reward' }} />
        <Stack.Screen name="entry/[id]" options={{ ...modal, title: 'Edit points' }} />
        <Stack.Screen name="notifications" options={{ ...pushed, title: 'Notifications' }} />
        <Stack.Screen name="settings" options={{ ...pushed, title: 'Settings' }} />
      </Stack.Protected>
    </Stack>
  );

  if (!signedIn || !onboarded) return stack;
  return (
    <ScoringProvider>
      <AppServices />
      {stack}
    </ScoringProvider>
  );
}

function NotConfigured() {
  return (
    <Centered>
      <Title>Contact 10</Title>
      <Body muted style={{ textAlign: 'center' }}>
        Firebase is not configured. Check src/lib/firebase.ts or your .env file, then restart the dev server.
      </Body>
    </Centered>
  );
}
