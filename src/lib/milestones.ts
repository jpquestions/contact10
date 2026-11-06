/** Lifetime point thresholds. Must match public.milestones in the database. */
export const MILESTONES = [10, 50, 100, 200, 300, 400, 500, 1000, 2500, 5000, 10000] as const;

export type MilestoneProgress = {
  /** Highest milestone reached, or null before the first one. */
  reached: number | null;
  /** Next milestone to aim for, or null once every milestone is reached. */
  next: number | null;
  /** Progress from the previous milestone (or zero) to the next, 0 to 1. */
  fraction: number;
};

export function milestoneProgress(points: number): MilestoneProgress {
  const reachedList = MILESTONES.filter((m) => points >= m);
  const reached = reachedList.length ? reachedList[reachedList.length - 1] : null;
  const next = MILESTONES.find((m) => points < m) ?? null;
  if (next === null) return { reached, next, fraction: 1 };
  const floor = reached ?? 0;
  return { reached, next, fraction: (points - floor) / (next - floor) };
}

/** Every milestone crossed when a total moves from `before` to `after`. */
export function crossedMilestones(before: number, after: number): number[] {
  return MILESTONES.filter((m) => before < m && after >= m);
}
