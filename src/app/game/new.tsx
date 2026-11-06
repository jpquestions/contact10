import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Chip, ErrorText, Field, Segmented } from '../../components/controls';
import { Body, Button } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { api, errorMessage, type GameType, type RewardMode } from '../../lib/api';
import { defaultNightEnd, weekendWindow } from '../../lib/format';

const TARGETS = [10, 25, 50, 100];

function when(d: Date) {
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NewGame() {
  const [name, setName] = useState('');
  const [type, setType] = useState<GameType>('night');
  const [target, setTarget] = useState('50');
  const [reward, setReward] = useState('');
  const [mode, setMode] = useState<RewardMode>('first');
  const [houseRules, setHouseRules] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const window = useMemo(() => {
    const now = new Date();
    if (type === 'night') return { start: now, end: defaultNightEnd(now) };
    if (type === 'weekend') return weekendWindow(now);
    return { start: now, end: null };
  }, [type]);

  async function create() {
    const targetPoints = Number(target);
    if (!name.trim()) return setError('Give the game a name.');
    if (!Number.isInteger(targetPoints) || targetPoints < 1 || targetPoints > 100000) return setError('Target must be a whole number of points.');
    if (!reward.trim()) return setError('Set a reward for hitting the target.');
    setBusy(true);
    setError(null);
    try {
      const { gameId } = await api.createGame({
        name: name.trim(),
        type,
        targetPoints,
        rewardText: reward.trim(),
        rewardMode: mode,
        houseRules: houseRules.trim() || null,
        startsAt: window.start.getTime(),
        endsAt: window.end ? window.end.getTime() : null,
      });
      router.replace(`/game/${gameId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Field label="Name" value={name} onChangeText={setName} placeholder="Friday Night" maxLength={60} />
      <View style={{ gap: space.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>Length</Text>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'night', label: 'Night' },
            { value: 'weekend', label: 'Weekend' },
            { value: 'ongoing', label: 'Ongoing' },
          ]}
        />
        <Body muted>
          {window.end
            ? `${window.start.getTime() > Date.now() + 60000 ? `Starts ${when(window.start)}. ` : 'Starts now. '}Ends ${when(window.end)}.`
            : 'Runs until you end it.'}
        </Body>
      </View>
      <View style={{ gap: space.sm }}>
        <Field label="Target points" value={target} onChangeText={(t) => setTarget(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {TARGETS.map((t) => (
            <Chip key={t} label={String(t)} on={target === String(t)} onPress={() => setTarget(String(t))} />
          ))}
        </View>
      </View>
      <Field label="Reward" value={reward} onChangeText={setReward} placeholder="Loser buys breakfast" maxLength={200} />
      <View style={{ gap: space.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>Who gets the reward</Text>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'first', label: 'First to reach' },
            { value: 'everyone', label: 'Everyone who reaches' },
          ]}
        />
      </View>
      <Field label="House rules (optional)" value={houseRules} onChangeText={setHouseRules} multiline maxLength={500} placeholder="Anything special for this game" />
      <ErrorText>{error}</ErrorText>
      <Button label="Create game" onPress={create} loading={busy} />
    </ScrollView>
  );
}
