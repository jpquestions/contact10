export type RuleStep = { label: string; points: number; total: number };

const STEPS = [
  { label: 'Get in the bubble of a person', points: 1 },
  { label: 'Talk to them', points: 2 },
  { label: 'Make them laugh', points: 3 },
  { label: 'Get a number or contact info', points: 4 },
];

/** The scoring ladder, with the running total after each step. */
export const RULE_STEPS: RuleStep[] = STEPS.reduce<RuleStep[]>((acc, step) => {
  const prev = acc.length ? acc[acc.length - 1].total : 0;
  acc.push({ ...step, total: prev + step.points });
  return acc;
}, []);

/** A full contact: every step on the ladder. */
export const FULL_CONTACT = RULE_STEPS[RULE_STEPS.length - 1].total;

export const QUICK_ADD = [1, 2, 3, 6, 10] as const;
export const MIN_ENTRY = 1;
export const MAX_ENTRY = 100;

export function isValidEntry(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_ENTRY && amount <= MAX_ENTRY;
}
