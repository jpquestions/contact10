import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

export const db = () => getFirestore();

export function requireUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

type Data = Record<string, unknown>;

export function input(request: CallableRequest<unknown>): Data {
  const d = request.data;
  return d && typeof d === 'object' ? (d as Data) : {};
}

export function str(data: Data, key: string, opts: { min?: number; max: number; optional?: boolean }): string | null {
  const v = data[key];
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return null;
    throw new HttpsError('invalid-argument', `${key} is required.`);
  }
  if (typeof v !== 'string') throw new HttpsError('invalid-argument', `${key} must be text.`);
  const t = v.trim();
  if (t.length < (opts.min ?? 1) || t.length > opts.max) {
    throw new HttpsError('invalid-argument', `${key} must be ${opts.min ?? 1} to ${opts.max} characters.`);
  }
  return t;
}

export function id(data: Data, key: string, optional = false): string | null {
  const v = data[key];
  if ((v === undefined || v === null) && optional) return null;
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) {
    throw new HttpsError('invalid-argument', `${key} is not valid.`);
  }
  return v;
}

export function int(data: Data, key: string, min: number, max: number): number {
  const v = data[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpsError('invalid-argument', `${key} must be a whole number from ${min} to ${max}.`);
  }
  return v;
}

export function bool(data: Data, key: string): boolean {
  const v = data[key];
  if (typeof v !== 'boolean') throw new HttpsError('invalid-argument', `${key} must be true or false.`);
  return v;
}

export function oneOf<T extends string>(data: Data, key: string, options: readonly T[]): T {
  const v = data[key];
  if (typeof v !== 'string' || !options.includes(v as T)) {
    throw new HttpsError('invalid-argument', `${key} must be one of ${options.join(', ')}.`);
  }
  return v as T;
}
