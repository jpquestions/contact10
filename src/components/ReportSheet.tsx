import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, errorMessage, type ReportReason } from '../lib/api';
import { Chip, ErrorText, Field, Sheet } from './controls';
import { Body, Button } from './ui';
import { colors, space } from './theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'spam', label: 'Spam' },
  { value: 'cheating', label: 'Cheating' },
  { value: 'other', label: 'Other' },
];

export type ReportTarget = { type: 'user' | 'game'; id: string; label: string };

/** Report a user or a game. Reports go to the Contact 10 team, not the other person. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if ((target?.id ?? null) !== openedFor) {
    setOpenedFor(target?.id ?? null);
    setReason(null);
    setDetails('');
    setDone(false);
    setError(null);
  }

  async function send() {
    if (!target || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await api.reportContent({ targetType: target.type, targetId: target.id, reason, details: details.trim() || null });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={target !== null} onClose={onClose}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Report {target?.label}</Text>
      {done ? (
        <>
          <Body muted>Thanks. The Contact 10 team will review it. You can also block a user from the Friends tab.</Body>
          <Button label="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Body muted>Reports go to the Contact 10 team. The person you report is not told who reported them.</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {REASONS.map((r) => (
              <Chip key={r.value} label={r.label} on={reason === r.value} onPress={() => setReason(r.value)} />
            ))}
          </View>
          <Field value={details} onChangeText={setDetails} placeholder="Details (optional)" maxLength={500} multiline />
          <ErrorText>{error}</ErrorText>
          <Button label="Send report" onPress={send} loading={busy} disabled={!reason} />
        </>
      )}
    </Sheet>
  );
}
