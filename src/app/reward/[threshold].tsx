import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { ErrorText, Field } from '../../components/controls';
import { Body, Button } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { useRewards } from '../../lib/hooks';
import { MILESTONES } from '../../lib/milestones';

/** Set or clear your personal reward for one lifetime milestone. */
export default function EditReward() {
  const { threshold } = useLocalSearchParams<{ threshold: string }>();
  const milestone = Number(threshold);
  const { user, profile } = useAuth();
  const { data: rewards, loading } = useRewards();
  const current = rewards.find((r) => r.id === String(milestone))?.rewardText ?? '';
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !loaded) {
      setText(current);
      setLoaded(true);
    }
  }, [loading, loaded, current]);

  const valid = (MILESTONES as readonly number[]).includes(milestone);
  const points = profile?.lifetimePoints ?? 0;

  async function save(clear = false) {
    if (!user || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const ref = doc(db, `users/${user.uid}/rewards/${milestone}`);
      if (!clear && text.trim()) await setDoc(ref, { rewardText: text.trim() });
      else await deleteDoc(ref);
      router.back();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Reward at ${milestone.toLocaleString()}` }} />
      {!valid ? (
        <Body muted>That milestone does not exist.</Body>
      ) : (
        <>
          <Body muted>
            {points >= milestone
              ? `You reached ${milestone.toLocaleString()} points. Set what you earned.`
              : `${(milestone - points).toLocaleString()} points to go. What will you treat yourself to when you hit ${milestone.toLocaleString()}?`}
          </Body>
          <Field
            label="Your reward"
            value={text}
            onChangeText={setText}
            placeholder="New shoes, a weekend away..."
            maxLength={200}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => save()}
          />
          <ErrorText>{error}</ErrorText>
          <Button label="Save reward" onPress={() => save()} loading={busy} disabled={!text.trim() || text.trim() === current} />
          {current ? <Button label="Remove reward" variant="ghost" onPress={() => save(true)} disabled={busy} /> : null}
        </>
      )}
    </ScrollView>
  );
}
