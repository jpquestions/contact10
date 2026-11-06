import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Row } from '../components/controls';
import { Body, Card, Screen } from '../components/ui';
import { colors, radius } from '../components/theme';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { timeAgo } from '../lib/format';
import { useNotifications } from '../lib/hooks';

export default function Notifications() {
  const { user } = useAuth();
  const { data: notes, loading } = useNotifications();

  // Mark everything read shortly after the inbox is seen.
  useEffect(() => {
    const unread = notes.filter((n) => !n.readAt);
    if (!unread.length) return;
    const t = setTimeout(() => {
      unread.forEach((n) => updateDoc(doc(db, `users/${user!.uid}/notifications/${n.id}`), { readAt: serverTimestamp() }).catch(() => undefined));
    }, 1500);
    return () => clearTimeout(t);
  }, [notes, user]);

  return (
    <Screen header>
      {!loading && notes.length === 0 && <Body muted>Nothing yet. Invites, friend requests and milestones show up here.</Body>}
      {notes.length > 0 && (
        <Card style={{ gap: 0 }}>
          {notes.map((n) => (
            <Row key={n.id} onPress={n.data?.gameId ? () => router.push(`/game/${n.data.gameId}`) : n.data?.userId ? () => router.push('/friends') : undefined}>
              <View style={[styles.dot, !n.readAt && styles.unread]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: 'transparent' },
  unread: { backgroundColor: colors.accent },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  time: { color: colors.textMuted, fontSize: 12 },
});
