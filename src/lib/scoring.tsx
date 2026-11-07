import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { CelebrationModal, type Celebration } from '../components/CelebrationModal';
import { ScoreToast, type ToastState } from '../components/ScoreToast';
import { WidgetIntroModal } from '../components/WidgetIntroModal';
import { api, errorMessage, type AddPointsResult } from './api';
import { useAuth } from './auth';
import { db } from './firebase';
import { takePendingWidgetEntries } from './widget';

const QUEUE_KEY = 'contact10.pendingEntries';

type Pending = { entryId: string; gameId: string | null; amount: number; source: 'app' | 'widget'; attempts?: number };

const MAX_ATTEMPTS = 20;

type ScoringState = {
  score: (amount: number, gameId: string | null, gameName?: string | null) => Promise<void>;
};

const ScoringContext = createContext<ScoringState | null>(null);

async function readQueue(): Promise<Pending[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]') as Pending[];
  } catch {
    return [];
  }
}

async function writeQueue(items: Pending[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Best effort.
  }
}

function isNetworkError(err: unknown) {
  const code = (err as { code?: string }).code;
  return code === 'functions/unavailable' || code === 'functions/deadline-exceeded' || code === 'functions/internal';
}

export function ScoringProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth();
  const uid = user?.uid ?? null;
  const [toast, setToast] = useState<ToastState | null>(null);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [showWidgetIntro, setShowWidgetIntro] = useState(false);
  const flushing = useRef(false);

  // Deliver anything logged offline, from the app or the widget.
  const flush = useCallback(async () => {
    if (!uid || flushing.current) return;
    flushing.current = true;
    try {
      const fromWidget: Pending[] = (await takePendingWidgetEntries()).map((e) => ({ ...e, source: 'widget' }));
      const queued: Pending[] = [...(await readQueue()), ...fromWidget];
      const left: Pending[] = [];
      for (const item of queued) {
        try {
          await api.addPoints({ entryId: item.entryId, gameId: item.gameId, amount: item.amount, source: item.source });
        } catch (err) {
          const attempts = (item.attempts ?? 0) + 1;
          if (isNetworkError(err) && attempts < MAX_ATTEMPTS) left.push({ ...item, attempts });
        }
      }
      await writeQueue(left);
    } finally {
      flushing.current = false;
    }
  }, [uid]);

  useEffect(() => {
    flush();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && flush());
    return () => sub.remove();
  }, [flush]);

  const celebrate = useCallback(
    async (result: AddPointsResult, gameName: string | null, gameId: string | null) => {
      const items: Celebration[] = [];
      if (result.reachedTarget && gameId) {
        const game = await getDoc(doc(db, `games/${gameId}`));
        const everyone = game.get('rewardMode') === 'everyone';
        if (everyone || result.wonGame) {
          items.push({
            title: result.wonGame ? 'You won!' : 'Target reached!',
            subtitle: `${gameName ?? 'Game'}: ${game.get('targetPoints')} points`,
            reward: game.get('rewardText') as string,
          });
        }
      }
      for (const m of result.unlocked) {
        let reward: string | null = null;
        if (uid) {
          const r = await getDoc(doc(db, `users/${uid}/rewards/${m}`));
          reward = r.exists() ? (r.get('rewardText') as string) : null;
        }
        items.push({ title: `${m.toLocaleString()} points!`, subtitle: 'Milestone reached', reward });
      }
      if (items.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCelebrations((c) => [...c, ...items]);
      }
    },
    [uid],
  );

  const score = useCallback(
    async (amount: number, gameId: string | null, gameName: string | null = null) => {
      const entry: Pending = { entryId: Crypto.randomUUID(), gameId, amount, source: 'app' };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setToast({ key: entry.entryId, amount, gameName, status: 'saving' });
      try {
        const result = await api.addPoints({ entryId: entry.entryId, gameId, amount, source: 'app' });
        setToast({ key: entry.entryId, amount, gameName, status: 'saved', entryId: result.entryId });
        await celebrate(result, gameName, gameId);
        if (profile && !profile.seenWidgetIntroFirstScore) {
          setShowWidgetIntro(true);
          updateProfile({ seenWidgetIntroFirstScore: true });
        }
      } catch (err) {
        if (isNetworkError(err)) {
          await writeQueue([...(await readQueue()), entry]);
          setToast({ key: entry.entryId, amount, gameName, status: 'queued' });
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setToast({ key: entry.entryId, amount, gameName, status: 'error', message: errorMessage(err) });
        }
      }
    },
    [celebrate, profile, updateProfile],
  );

  const undo = useCallback(async (entryId: string) => {
    setToast((t) => (t ? { ...t, status: 'undoing' } : t));
    try {
      await api.removePoints({ entryId });
      setToast((t) => (t ? { ...t, status: 'undone' } : t));
    } catch (err) {
      setToast((t) => (t ? { ...t, status: 'error', message: errorMessage(err) } : t));
    }
  }, []);

  const value = useMemo(() => ({ score }), [score]);

  return (
    <ScoringContext.Provider value={value}>
      {children}
      <ScoreToast toast={toast} onUndo={undo} onDismiss={() => setToast(null)} />
      <CelebrationModal item={celebrations[0] ?? null} onClose={() => setCelebrations((c) => c.slice(1))} />
      <WidgetIntroModal
        visible={showWidgetIntro && celebrations.length === 0}
        firstScore
        onClose={() => setShowWidgetIntro(false)}
      />
    </ScoringContext.Provider>
  );
}

export function useScoring(): ScoringState {
  const ctx = useContext(ScoringContext);
  if (!ctx) throw new Error('useScoring must be used inside ScoringProvider');
  return ctx;
}
