/**
 * The part of a verified access token logout needs: which token it is, and
 * when it would have expired on its own.
 */
export interface TokenIdentity {
  jti: string;
  expiresAt: number;
}
