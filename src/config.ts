/**
 * Dropbox app key for backups. Public by design: sign-in uses PKCE, so there's no secret.
 * Set it here, or with VITE_DROPBOX_APP_KEY at build time. Setup steps: docs/DROPBOX.md.
 */
const BUILT_IN_DROPBOX_APP_KEY = '6mqbk3rfe7hzkjj';

export const DROPBOX_APP_KEY: string =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) || BUILT_IN_DROPBOX_APP_KEY;
