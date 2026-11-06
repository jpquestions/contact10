import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { useInvites } from '../lib/hooks';
import { ErrorText, SectionTitle } from './controls';
import { Button, Card } from './ui';
import { colors, space } from './theme';

/** Pending game invites from friends, with accept and decline. */
export function InviteList() {
  const { data: invites } = useInvites();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = invites.filter((i) => i.expiresAt.toMillis() > Date.now());
  if (live.length === 0) return null;

  async function answer(inviteId: string, accept: boolean) {
    setBusy(inviteId);
    setError(null);
    try {
      const res = await api.respondToInvite({ inviteId, accept });
      if (accept) router.push(`/game/${res.gameId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>Game invites</SectionTitle>
      {live.map((i) => (
        <Card key={i.id}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{i.gameName}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Join" onPress={() => answer(i.id, true)} loading={busy === i.id} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Decline" variant="secondary" onPress={() => answer(i.id, false)} disabled={busy === i.id} />
            </View>
          </View>
        </Card>
      ))}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
