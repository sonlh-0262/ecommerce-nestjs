/**
 * A freshly issued access token and how long the client may use it.
 *
 * `expiresIn` is seconds, read back off the signed token rather than parsed
 * from `JWT_EXPIRES_IN`, so the number the client is told and the `exp` claim
 * it will be judged against can never disagree.
 */
export interface AuthSession {
  token: string;
  expiresIn: number;
}
