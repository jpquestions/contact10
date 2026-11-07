// Shared widget logic. Pure TypeScript so it runs in the app, in the Android
// widget's background task, and in node tests. The iOS widget mirrors this in
// targets/widget/*.swift.

export type WidgetLeader = { username: string; points: number };
export type WidgetGame = { id: string; name: string; points: number; leaders: WidgetLeader[] };

/** What the app shares with the widgets. */
export type WidgetState = {
  refreshToken: string;
  apiKey: string;
  functionsBase: string;
  username: string;
  lifetimePoints: number;
  /** The game the app last used; the widget follows it until you pick one. */
  activeGameId: string | null;
  /** Your live games, with your points and the top five. */
  games: WidgetGame[];
};

export type WidgetTarget = { kind: 'solo' } | { kind: 'game'; game: WidgetGame };

export type PendingWidgetEntry = { entryId: string; gameId: string | null; amount: number };

/** Stored target choice: 'solo', a game id, or null to follow the app. */
export const SOLO = 'solo';

export function resolveTarget(state: WidgetState, chosen: string | null): WidgetTarget {
  if (chosen === SOLO) return { kind: 'solo' };
  const pick = state.games.find((g) => g.id === chosen) ?? state.games.find((g) => g.id === state.activeGameId);
  return pick ? { kind: 'game', game: pick } : { kind: 'solo' };
}

/** The next choice when the widget's title is tapped: each live game, then Personal. */
export function nextTargetId(state: WidgetState, current: WidgetTarget): string {
  const order = [...state.games.map((g) => g.id), SOLO];
  const at = order.indexOf(current.kind === 'solo' ? SOLO : current.game.id);
  return order[(at + 1) % order.length];
}

export function targetLabel(target: WidgetTarget): string {
  return target.kind === 'solo' ? 'Personal' : target.game.name;
}

export function targetPoints(state: WidgetState, target: WidgetTarget): number {
  return target.kind === 'solo' ? state.lifetimePoints : target.game.points;
}

/** The state after adding points, shown right away while the server confirms. */
export function withPoints(state: WidgetState, gameId: string | null, amount: number): WidgetState {
  return {
    ...state,
    lifetimePoints: state.lifetimePoints + amount,
    games: state.games.map((g) => (g.id === gameId ? { ...g, points: g.points + amount } : g)),
  };
}

export class WidgetApiError extends Error {
  readonly network: boolean;
  constructor(message: string, network: boolean) {
    super(message);
    this.network = network;
  }
}

type TokenCache = { get(): Promise<{ token: string; expiresAt: number } | null>; set(v: { token: string; expiresAt: number }): Promise<void> };

/** A short lived Firebase ID token from the stored refresh token. */
export async function idToken(state: WidgetState, cache: TokenCache, now = Date.now()): Promise<string> {
  const cached = await cache.get();
  if (cached && cached.expiresAt > now + 60_000) return cached.token;
  let res: Response;
  try {
    res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${state.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(state.refreshToken)}`,
    });
  } catch {
    throw new WidgetApiError('Offline', true);
  }
  if (!res.ok) throw new WidgetApiError('Open Contact 10 to sign in again.', false);
  const json = (await res.json()) as { id_token: string; expires_in: string };
  await cache.set({ token: json.id_token, expiresAt: now + Number(json.expires_in || 3600) * 1000 });
  return json.id_token;
}

export async function postAddPoints(
  state: WidgetState,
  token: string,
  entry: PendingWidgetEntry,
): Promise<{ lifetimePoints: number; gamePoints: number | null }> {
  let res: Response;
  try {
    res = await fetch(`${state.functionsBase}/addPoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { ...entry, source: 'widget' } }),
    });
  } catch {
    throw new WidgetApiError('Offline', true);
  }
  let json: { result?: { lifetimePoints: number; gamePoints: number | null }; error?: { message: string } };
  try {
    json = await res.json();
  } catch {
    throw new WidgetApiError('Server hiccup', true);
  }
  if (json.result) return json.result;
  throw new WidgetApiError(json.error?.message ?? 'Could not add points.', false);
}
