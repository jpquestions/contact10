import type { Timestamp } from 'firebase/firestore';
import type { Game } from './types';

export function timeAgo(ts: Timestamp | null, now = Date.now()): string {
  if (!ts) return 'just now';
  const s = Math.max(0, Math.round((now - ts.toMillis()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function gameStatusLine(game: Game, now = Date.now()): string {
  if (game.status === 'ended') return 'Ended';
  if (game.startsAt.toMillis() > now) return `Starts ${game.startsAt.toDate().toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  if (!game.endsAt) return 'Ongoing';
  const left = game.endsAt.toMillis() - now;
  if (left <= 0) return 'Ending';
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export const GAME_TYPE_LABEL = { night: 'Single night', weekend: 'Weekend', ongoing: 'Ongoing' } as const;

/** 6:00 AM tomorrow, local time. */
export function defaultNightEnd(now = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + (now.getHours() < 6 ? 0 : 1));
  end.setHours(6, 0, 0, 0);
  return end;
}

/** The current or upcoming weekend: Friday 5:00 PM to Sunday 11:59 PM, local time. */
export function weekendWindow(now = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0 Sunday ... 5 Friday, 6 Saturday
  const friday = new Date(now);
  const offset = day === 0 ? -2 : day === 6 ? -1 : 5 - day;
  friday.setDate(now.getDate() + offset);
  friday.setHours(17, 0, 0, 0);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 0, 0);
  return { start: friday.getTime() < now.getTime() ? now : friday, end: sunday };
}
