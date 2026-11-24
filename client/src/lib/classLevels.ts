// Seven class levels. Internally a level is (stage, year): stage "JSS" is Ihdaady (years 1 to 4) and "SSS" is Thaanawiy (years 1 to 3).
// Only the displayed names are different, so existing records keep working. The server has the same list in utils/academicNames.ts.
export type Stage = "JSS" | "SSS";
export interface ClassLevel { stage: Stage; year: number; name: string; value: string }

const L = (stage: Stage, year: number, name: string): ClassLevel => ({ stage, year, name, value: `${stage}|${year}` });
export const CLASS_LEVELS: ClassLevel[] = [
  L("JSS", 1, "Ihdaady Awwal"),
  L("JSS", 2, "Ihdaady Thaany"),
  L("JSS", 3, "Ihdaady Thaalith"),
  L("JSS", 4, "Ihdaady Raabih"),
  L("SSS", 1, "Thaanawiy Awwal"),
  L("SSS", 2, "Thaanawiy Thaaniy"),
  L("SSS", 3, "Thaanawiy Thaalith"),
];
export const levelName = (stage: string, year: number) => CLASS_LEVELS.find((l) => l.stage === stage && l.year === year)?.name ?? `${stage} ${year}`;
export const levelValue = (stage: string, year: number) => `${stage}|${year}`;
export const parseLevel = (value: string): { stage: Stage; year: number } => {
  const [stage, year] = value.split("|");
  return { stage: stage as Stage, year: Number(year) };
};
