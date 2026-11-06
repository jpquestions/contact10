import { collection, documentId, getDocs, limit, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, ErrorText, Field, Row, SectionTitle } from '../../components/controls';
import { Body, Card, Screen, Title } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { useFriendships, useProfiles } from '../../lib/hooks';
import { milestoneProgress } from '../../lib/milestones';

export default function Friends() {
  const { user, profile } = useAuth();
  const uid = user!.uid;
  const { data: pairs } = useFriendships();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ username: string; uid: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const other = (p: { userA: string; userB: string }) => (p.userA === uid ? p.userB : p.userA);
  const friends = pairs.filter((p) => p.status === 'accepted');
  const incoming = pairs.filter((p) => p.status === 'pending' && p.actedBy !== uid);
  const outgoing = pairs.filter((p) => p.status === 'pending' && p.actedBy === uid);
  const ids = useMemo(() => pairs.filter((p) => p.status !== 'blocked').map(other), [pairs]); // eslint-disable-line react-hooks/exhaustive-deps
  const profiles = useProfiles(ids);
  const known = new Set(pairs.map(other));

  // Prefix search on usernames, debounced.
  useEffect(() => {
    const q = search.trim().toLowerCase().replace(/^@/, '');
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'usernames'), where(documentId(), '>=', q), where(documentId(), '<', `${q}`), limit(20)),
        );
        setResults(snap.docs.map((d) => ({ username: d.id, uid: d.get('uid') as string })).filter((r) => r.uid !== uid));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, uid]);

  async function act(action: () => Promise<unknown>, done?: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      if (done) setMessage(done);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function manage(friendId: string, name: string) {
    const remove = () => act(() => api.removeFriend({ userId: friendId }), `Removed @${name}.`);
    const block = () =>
      Alert.alert('Block user', `@${name} will not be able to see you or send you requests.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => act(() => api.blockUser({ userId: friendId }), `Blocked @${name}.`) },
      ]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: `@${name}`, options: ['Remove friend', 'Block', 'Cancel'], destructiveButtonIndex: [0, 1], cancelButtonIndex: 2 },
        (i) => (i === 0 ? remove() : i === 1 ? block() : undefined),
      );
    } else {
      Alert.alert(`@${name}`, undefined, [
        { text: 'Remove friend', onPress: remove },
        { text: 'Block', style: 'destructive', onPress: block },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <Screen>
      <Title>Friends</Title>
      <Field value={search} onChangeText={setSearch} placeholder="Search by username" autoCapitalize="none" autoCorrect={false} />
      {results.length > 0 && (
        <Card style={{ gap: 0 }}>
          {results.map((r) => (
            <Row key={r.uid}>
              <Text style={styles.name}>@{r.username}</Text>
              <View style={{ flex: 1 }} />
              {known.has(r.uid) ? (
                <Badge label="Added" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    act(async () => {
                      const res = await api.sendFriendRequest({ username: r.username });
                      setSearch('');
                      return res;
                    }, `Request sent to @${r.username}.`)
                  }
                >
                  <Text style={styles.action}>Add</Text>
                </Pressable>
              )}
            </Row>
          ))}
        </Card>
      )}
      {message && <Body muted>{message}</Body>}
      <ErrorText>{error}</ErrorText>

      {incoming.length > 0 && (
        <>
          <SectionTitle right={<Badge label={String(incoming.length)} tone="accent" />}>Requests</SectionTitle>
          <Card style={{ gap: 0 }}>
            {incoming.map((p) => {
              const id = other(p);
              const name = profiles[id]?.username ?? '...';
              return (
                <Row key={p.id}>
                  <Text style={[styles.name, { flex: 1 }]}>@{name}</Text>
                  <Pressable accessibilityRole="button" onPress={() => act(() => api.respondToFriendRequest({ userId: id, accept: true }))}>
                    <Text style={styles.action}>Accept</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => act(() => api.respondToFriendRequest({ userId: id, accept: false }))}>
                    <Text style={styles.muted}>Decline</Text>
                  </Pressable>
                </Row>
              );
            })}
          </Card>
        </>
      )}

      <SectionTitle>Your friends</SectionTitle>
      {friends.length === 0 ? (
        <Body muted>Search for a username to add your first friend. You get notified when friends hit their goals.</Body>
      ) : (
        <Card style={{ gap: 0 }}>
          {friends
            .map((p) => ({ id: other(p), p: profiles[other(p)] }))
            .sort((a, b) => (b.p?.lifetimePoints ?? 0) - (a.p?.lifetimePoints ?? 0))
            .map(({ id, p }) => {
              const reached = milestoneProgress(p?.lifetimePoints ?? 0).reached;
              return (
                <Row key={id} onPress={() => manage(id, p?.username ?? 'friend')} accessibilityLabel={`${p?.username}, ${p?.lifetimePoints ?? 0} points`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>@{p?.username ?? '...'}</Text>
                    <Text style={styles.meta}>{reached ? `${reached.toLocaleString()} milestone` : 'No milestones yet'}</Text>
                  </View>
                  <Text style={styles.points}>{(p?.lifetimePoints ?? 0).toLocaleString()}</Text>
                </Row>
              );
            })}
        </Card>
      )}

      {outgoing.length > 0 && (
        <>
          <SectionTitle>Sent</SectionTitle>
          <Card style={{ gap: 0 }}>
            {outgoing.map((p) => (
              <Row key={p.id}>
                <Text style={[styles.name, { flex: 1 }]}>@{profiles[other(p)]?.username ?? '...'}</Text>
                <Pressable accessibilityRole="button" onPress={() => act(() => api.removeFriend({ userId: other(p) }))}>
                  <Text style={styles.muted}>Cancel</Text>
                </Pressable>
              </Row>
            ))}
          </Card>
        </>
      )}
      <Body muted style={{ fontSize: 13 }}>
        Signed in as @{profile?.username}. Only friends and people in your games can see your points.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  points: { color: colors.text, fontSize: 20, fontWeight: '900' },
  action: { color: colors.accent, fontSize: 15, fontWeight: '800', paddingHorizontal: space.xs },
  muted: { color: colors.textMuted, fontSize: 15, fontWeight: '700', paddingHorizontal: space.xs },
});
