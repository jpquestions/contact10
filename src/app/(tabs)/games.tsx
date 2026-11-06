import { router } from 'expo-router';
import { View } from 'react-native';
import { SectionTitle } from '../../components/controls';
import { GameCard } from '../../components/GameCard';
import { InviteList } from '../../components/InviteList';
import { Body, Button, Screen, Title } from '../../components/ui';
import { space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { useMyGames } from '../../lib/hooks';

export default function Games() {
  const { user } = useAuth();
  const { data: games, loading } = useMyGames();
  const active = games.filter((g) => g.status === 'active');
  const ended = games.filter((g) => g.status === 'ended');

  return (
    <Screen>
      <Title>Games</Title>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="New game" onPress={() => router.push('/game/new')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Join with code" variant="secondary" onPress={() => router.push('/join/enter')} />
        </View>
      </View>
      <InviteList />
      <SectionTitle>Active</SectionTitle>
      {!loading && active.length === 0 && <Body muted>No active games yet.</Body>}
      {active.map((g) => (
        <GameCard key={g.id} game={g} uid={user!.uid} />
      ))}
      {ended.length > 0 && <SectionTitle>Past games</SectionTitle>}
      {ended.map((g) => (
        <GameCard key={g.id} game={g} uid={user!.uid} />
      ))}
    </Screen>
  );
}
