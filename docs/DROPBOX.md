# Dropbox backup: one-time setup

Margins backs up to your own Dropbox, into an app folder: `Dropbox/Apps/<app name>/`. It signs in with PKCE, so there's no server and no secret. The app key below is public by design.

## 1. Create the Dropbox app (free, about 3 minutes)
1. Go to https://www.dropbox.com/developers/apps and tap **Create app**.
2. **Choose an API:** Scoped access.
3. **Type of access:** App folder. (Margins can only see its own folder, nothing else in your Dropbox.)
4. **Name:** anything unique, like `Margins notebook 4821`. This becomes the folder name under `Apps/`.
5. Open the **Permissions** tab. Tick `files.metadata.read`, `files.content.write` and `files.content.read`. Tap **Submit** at the bottom.
6. Open the **Settings** tab:
   - **OAuth 2 > Redirect URIs:** add `https://margins-gilt.vercel.app/auth/dropbox`. For local testing also add `http://localhost:5173/auth/dropbox` and `http://localhost:4173/auth/dropbox`.
   - **Allow public clients (Implicit Grant & PKCE):** leave on Allow.
   - Copy the **App key** (not the App secret, which Margins never uses).
7. Leave the app in Development status. That's fine for your own account.

## 2. Put the key in the app
Either set `BUILT_IN_DROPBOX_APP_KEY` in `src/config.ts` and push, or add an environment variable `VITE_DROPBOX_APP_KEY` in Vercel (Project > Settings > Environment Variables) and redeploy.

## 3. Connect
In Margins: Settings > Dropbox > **Connect Dropbox**, allow access, and you're sent back to Settings. If the hop back to the home screen app ever fails on iPhone, use **Use a code instead**: Dropbox shows a code, you paste it into Margins.

If you change permissions later, tap Disconnect and connect again.

## What's in the folder
| path | what | written |
|---|---|---|
| `margins.json` | every page, memo details, settings | replaced after changes, only over the copy this device last wrote |
| `audio/<memoId>.<ext>` | one recording per memo | once, never overwritten |
| `snapshots/margins-YYYY-MM-DD.json` | a dated copy of `margins.json` | once a day; the newest 30 are kept |

Nothing else is ever deleted from Dropbox. Dropbox also keeps its own version history of `margins.json`.

## When it backs up
On launch, when the phone comes back online, when you leave the app, and about 45 seconds after any change. "Back up now" in Settings runs it right away.

## Conflicts and restores
If `margins.json` in Dropbox changed since this device last wrote it (another device, or a reinstall), backups pause and Settings shows **Merge with Dropbox**. Merging adds anything from Dropbox that's missing here, keeps the newer copy of any page edited in both places, downloads missing audio, then backs up the result. Nothing is deleted on either side. **Restore from Dropbox** does the same merge on demand, for a new phone.
