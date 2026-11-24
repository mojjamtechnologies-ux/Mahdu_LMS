// The school year has two semesters, and seven class levels. Internally a level is still stored as (stage, year):
//   stage 'JSS' = Ihdaady (years 1 to 4), stage 'SSS' = Thaanawiy (years 1 to 3). Only the displayed names are different.
// The same names exist in SQL as class_label(stage, year, arm) (migration 019). Keep the two in step.
export type Stage = 'JSS' | 'SSS';

export const TERM_NAMES = ['First Semester', 'Second Semester'];
export const TERMS_PER_YEAR = TERM_NAMES.length;
/** Name of semester n. Anything outside 1-2 (old third-term data) gets a plain fallback instead of "undefined". */
export const termName = (n: number) => TERM_NAMES[n - 1] ?? `Semester ${n}`;

export const CLASS_LEVELS: { stage: Stage; year: number; name: string }[] = [
  { stage: 'JSS', year: 1, name: 'Ihdaady Awwal' },
  { stage: 'JSS', year: 2, name: 'Ihdaady Thaany' },
  { stage: 'JSS', year: 3, name: 'Ihdaady Thaalith' },
  { stage: 'JSS', year: 4, name: 'Ihdaady Raabih' },
  { stage: 'SSS', year: 1, name: 'Thaanawiy Awwal' },
  { stage: 'SSS', year: 2, name: 'Thaanawiy Thaaniy' },
  { stage: 'SSS', year: 3, name: 'Thaanawiy Thaalith' },
];
export const maxYear = (stage: string) => (stage === 'JSS' ? 4 : 3);
export const levelName = (stage: string, year: number) => CLASS_LEVELS.find((l) => l.stage === stage && l.year === year)?.name ?? `${stage} ${year}`;
export const classLabel = (c: { stage: string; year: number; arm?: string | null }) => `${levelName(c.stage, c.year)}${c.arm ? ` ${c.arm}` : ''}`;
