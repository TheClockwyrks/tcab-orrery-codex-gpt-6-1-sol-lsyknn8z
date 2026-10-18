/** Deferred presentation events; never consulted by the rules or snapshots. */
const pending = new Set<string>();
export const deferCue = (name: string) => {
  pending.add(name);
};
export const takeCues = () => {
  const cues = [...pending];
  pending.clear();
  return cues;
};
export const clearCues = () => pending.clear();
