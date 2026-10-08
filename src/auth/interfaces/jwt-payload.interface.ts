export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  pwv: number | null;
  jti: string;
  iat: number;
  exp: number;
}

/** The claims the service sets; `jti`, `iat` and `exp` are added on signing. */
export type JwtPayloadClaims = Pick<
  JwtPayload,
  'sub' | 'email' | 'username' | 'pwv'
>;
