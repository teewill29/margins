// Daily snapshots of margins.json in Dropbox: /snapshots/margins-YYYY-MM-DD.json, last 30 kept.

export const SNAPSHOTS_KEPT = 30;
const NAME = /^margins-\d{4}-\d{2}-\d{2}\.json$/;

export function snapshotName(date: string): string {
  return `margins-${date}.json`;
}

/** Snapshot file names to delete so only the newest `keep` remain. Ignores other files. */
export function snapshotsToDelete(names: readonly string[], keep = SNAPSHOTS_KEPT): string[] {
  return names
    .filter((n) => NAME.test(n))
    .sort()
    .reverse()
    .slice(keep);
}
