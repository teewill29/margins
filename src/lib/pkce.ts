// PKCE (RFC 7636) helpers for signing in to Dropbox without a server or a client secret.

export function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random code verifier: 64 URL-safe characters. */
export function randomVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(48)));
}

/** S256 code challenge for a verifier. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}
