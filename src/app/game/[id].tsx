import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Badge, ErrorText, Field, Row, SectionTitle, Sheet } from '../../components/controls';
import { EditEntrySheet } from '../../components/EditEntrySheet';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { ScorePanel } from '../../components/ScorePanel';
import { Body, Button, Card, Centered, ProgressBar, Screen, Title } from '../../components/ui';
import { colors, radius, space } from '../../components/theme';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { gameStatusLine, GAME_TYPE_LABEL, timeAgo } from '../../lib/format';
import { useFeed, useFlags, useFriendships, useGame, useMembers, useProfiles } from '../../lib/hooks';
import { canEditEntry, isLive, type Entry, type Game, type Member } from '../../lib/types';

const FLAG_AFTER_END_MS = 24 * 60 * 60 * 1000;

function canFlag(game: Game, now = Date.now()) {
  const end = game.status === 'ended' ? (game.endedAt ?? game.endsAt) : game.endsAt;
  return end === null || end.toMillis() + FLAG_AFTER_END_MS > now;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile, updateProfile } = useAuth();
  const uid = user!.uid;
  const { data: game, loading, error } = useGame(id);
  const { data: members } = useMembers(id);
  const { data: feed } = useFeed(id);
  const { data: flags } = useFlags(game?.createdBy === uid ? id : undefined);
  const [flagging, setFlagging] = useState<Entry | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const live = game ? isLive(game) : false;
  const isCreator = game?.createdBy === uid;

  // Opening a live game makes it the active one (widget and Home default).
  useEffect(() => {
    if (game && live && profile?.activeGameId !== game.id) updateProfile({ activeGameId: game.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, live]);

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }
  if (!game || error) {
    return (
      <Centered>
        <Body muted>This game is not available. You may have left it.</Body>
      </Centered>
    );
  }

  const winner = members.find((m) => m.id === game.winnerId);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function confirm(title: string, message: string, label: string, action: () => Promise<unknown>) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => run(action) },
    ]);
  }

  function playerOptions(m: Member) {
    const report = () => setReporting({ type: 'user', id: m.id, label: `@${m.username}` });
    const remove = () =>
      confirm('Remove player', `Remove @${m.username} from this game?`, 'Remove', () => api.removeMember({ gameId: game!.id, userId: m.id }));
    const canRemove = isCreator && game!.status === 'active';
    const options = canRemove ? ['Remove from game', 'Report', 'Cancel'] : ['Report', 'Cancel'];
    const handlers = canRemove ? [remove, report] : [report];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: `@${m.username}`, options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: canRemove ? 0 : undefined },
        (i) => handlers[i]?.(),
      );
    } else {
      Alert.alert(`@${m.username}`, undefined, [
        ...handlers.map((h, i) => ({ text: options[i], onPress: h })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  async function shareCode() {
    await run(async () => {
      const { code } = await api.createInviteLink({ gameId: game!.id });
      await Clipboard.setStringAsync(code);
      await Share.share({
        message: `Join my Contact 10 game "${game!.name}". Open contact10://join/${code} or enter code ${code} in the app.`,
      });
    });
  }

  return (
    <Screen header>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: space.xs }}>
        <Title>{game.name}</Title>
        <Body muted>
          {GAME_TYPE_LABEL[game.type]} · {gameStatusLine(game)} · {members.length} playing
        </Body>
      </View>

      {winner && (
        <Card style={{ borderColor: colors.success, borderWidth: 1 }}>
          <Text style={styles.winner}>{winner.id === uid ? 'You won!' : `@${winner.username} won`}</Text>
          <Body>{game.rewardText}</Body>
        </Card>
      )}

      <Card>
        <Text style={styles.label}>
          {game.rewardMode === 'first' ? `First to ${game.targetPoints} wins` : `Everyone who reaches ${game.targetPoints} earns`}
        </Text>
        <Text style={styles.reward}>{game.rewardText}</Text>
        {game.houseRules ? <Body muted>House rules: {game.houseRules}</Body> : null}
      </Card>

      {live && <ScorePanel fixedGame={{ id: game.id, name: game.name }} />}

      <SectionTitle>Leaderboard</SectionTitle>
      <Card style={{ gap: space.xs }}>
        {members.map((m, i) => (
          <LeaderRow
            key={m.id}
            member={m}
            rank={i + 1}
            game={game}
            isMe={m.id === uid}
            onLongPress={m.id !== uid ? () => playerOptions(m) : undefined}
          />
        ))}
      </Card>
      {members.length > 1 && <Body muted style={{ fontSize: 13, marginTop: -space.sm }}>Hold a player for more options.</Body>}

      {game.status === 'active' && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Invite friends" variant="secondary" onPress={() => setInviting(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Share code" variant="secondary" onPress={shareCode} />
          </View>
        </View>
      )}

      {isCreator && flags.length > 0 && (
        <>
          <SectionTitle right={<Badge label={String(flags.length)} tone="accent" />}>Flags to review</SectionTitle>
          {flags.map((f) => (
            <Card key={f.id}>
              <Body>
                @{f.entryUsername} +{f.amount}
              </Body>
              {f.reason ? <Body muted>“{f.reason}”</Body> : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Uphold"
                    onPress={() =>
                      confirm('Uphold flag', `Remove these ${f.amount} points from @${f.entryUsername}?`, 'Uphold', () =>
                        api.resolveFlag({ gameId: game.id, entryId: f.entryId, upheld: true }),
                      )
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Dismiss" variant="secondary" onPress={() => run(() => api.resolveFlag({ gameId: game.id, entryId: f.entryId, upheld: false }))} />
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Activity</SectionTitle>
      <Card style={{ gap: 0 }}>
        {feed.length === 0 && <Body muted>No points yet.</Body>}
        {feed.map((e) => (
          <FeedRow
            key={e.id}
            entry={e}
            isMine={e.userId === uid}
            canFlag={canFlag(game)}
            canEdit={e.userId === uid && canEditEntry(e, game)}
            onEdit={() => setEditing(e)}
            onFlag={() => setFlagging(e)}
          />
        ))}
      </Card>

      <ErrorText>{actionError}</ErrorText>

      {game.status === 'active' &&
        (isCreator ? (
          <Button
            label="End game"
            variant="ghost"
            onPress={() => confirm('End game', 'End this game for everyone? The leaderboard will be final.', 'End game', () => api.endGame({ gameId: game.id }))}
          />
        ) : (
          <Button
            label="Leave game"
            variant="ghost"
            onPress={() =>
              confirm('Leave game', 'Your points stay in your lifetime total.', 'Leave', async () => {
                await api.leaveGame({ gameId: game.id });
                router.back();
              })
            }
          />
        ))}

      {!isCreator && <Button label="Report this game" variant="ghost" onPress={() => setReporting({ type: 'game', id: game.id, label: 'this game' })} />}

      <FlagSheet entry={flagging} onClose={() => setFlagging(null)} />
      <EditEntrySheet entry={editing} gameName={game.name} onClose={() => setEditing(null)} />
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
      <InviteSheet visible={inviting} onClose={() => setInviting(false)} game={game} />
    </Screen>
  );
}

function LeaderRow({ member, rank, game, isMe, onLongPress }: { member: Member; rank: number; game: Game; isMe: boolean; onLongPress?: () => void }) {
  return (
    <Pressable onLongPress={onLongPress} accessibilityLabel={`Rank ${rank}, ${member.username}, ${member.points} points`} style={styles.leader}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[styles.name, isMe && { color: colors.accent }]} numberOfLines={1}>
            @{member.username}
            {isMe ? ' (you)' : ''}
          </Text>
          {game.winnerId === member.id && <Badge label="Winner" tone="success" />}
          {game.rewardMode === 'everyone' && member.reachedTargetAt && <Badge label="Reached" tone="success" />}
          {member.role === 'admin' && <Badge label="Creator" />}
        </View>
        <ProgressBar fraction={member.points / game.targetPoints} />
      </View>
      <Text style={styles.points}>{member.points}</Text>
    </Pressable>
  );
}

function FeedRow({
  entry,
  isMine,
  canFlag,
  canEdit,
  onEdit,
  onFlag,
}: {
  entry: Entry;
  isMine: boolean;
  canFlag: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onFlag: () => void;
}) {
  const removed = entry.deletedAt !== null;
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <Text style={[styles.feedText, removed && styles.struck]}>
          @{entry.username} +{entry.amount}
        </Text>
        <Text style={styles.feedMeta}>
          {timeAgo(entry.createdAt)}
          {entry.source === 'widget' ? ' · widget' : ''}
          {entry.editedAt && entry.originalAmount !== undefined ? ` · edited from ${entry.originalAmount}` : ''}
        </Text>
      </View>
      {entry.flagStatus === 'pending' && <Badge label="Flagged" tone="accent" />}
      {entry.removedByFlag && <Badge label="Removed" tone="danger" />}
      {removed && !entry.removedByFlag && <Badge label="Deleted" />}
      {entry.flagStatus === 'dismissed' && <Badge label="Stands" />}
      {canEdit && (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit your ${entry.amount} points`} hitSlop={8}>
          <Text style={styles.action}>Edit</Text>
        </Pressable>
      )}
      {!removed && !entry.flagStatus && !isMine && canFlag && (
        <Pressable onPress={onFlag} accessibilityRole="button" accessibilityLabel={`Flag ${entry.username}'s ${entry.amount} points`} hitSlop={8}>
          <Text style={styles.flag}>Flag</Text>
        </Pressable>
      )}
    </Row>
  );
}

function FlagSheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await api.flagEntry({ entryId: entry.id, reason: reason.trim() || null });
      setReason('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={entry !== null} onClose={onClose}>
      <Text style={styles.sheetTitle}>Flag these points?</Text>
      <Body muted>
        {entry ? `@${entry.username} +${entry.amount}. ` : ''}The game creator decides. If they uphold it, the points come off that player's totals.
      </Body>
      <Field value={reason} onChangeText={setReason} placeholder="Reason (optional)" maxLength={200} />
      <ErrorText>{error}</ErrorText>
      <Button label="Flag" onPress={submit} loading={busy} />
    </Sheet>
  );
}

function InviteSheet({ visible, onClose, game }: { visible: boolean; onClose: () => void; game: Game }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const { data: pairs } = useFriendships();
  const friendIds = useMemo(
    () =>
      pairs
        .filter((p) => p.status === 'accepted')
        .map((p) => (p.userA === uid ? p.userB : p.userA))
        .filter((f) => !game.memberIds.includes(f)),
    [pairs, uid, game.memberIds],
  );
  const profiles = useProfiles(friendIds);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const { invited } = await api.inviteFriends({ gameId: game.id, userIds: picked });
      setMessage(`Invited ${invited} friend${invited === 1 ? '' : 's'}.`);
      setPicked([]);
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Invite friends</Text>
      {friendIds.length === 0 && <Body muted>All your friends are already here, or you have not added any yet. Share a code instead.</Body>}
      {friendIds.map((f) => {
        const on = picked.includes(f);
        return (
          <Row key={f} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))} accessibilityLabel={`Invite ${profiles[f]?.username ?? 'friend'}`}>
            <View style={[styles.check, on && styles.checkOn]}>{on && <Text style={styles.checkMark}>✓</Text>}</View>
            <Text style={styles.name}>@{profiles[f]?.username ?? '...'}</Text>
          </Row>
        );
      })}
      {message && <Body muted>{message}</Body>}
      <Button label={picked.length ? `Invite ${picked.length}` : 'Invite'} onPress={send} loading={busy} disabled={picked.length === 0} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  reward: { color: colors.text, fontSize: 20, fontWeight: '800' },
  winner: { color: colors.success, fontSize: 22, fontWeight: '900' },
  leader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  points: { color: colors.text, fontSize: 22, fontWeight: '900', minWidth: 44, textAlign: 'right' },
  feedText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  feedMeta: { color: colors.textMuted, fontSize: 13 },
  action: { color: colors.accent, fontWeight: '800', fontSize: 15 },
  flag: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  check: { width: 26, height: 26, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.accentText, fontWeight: '900' },
});
