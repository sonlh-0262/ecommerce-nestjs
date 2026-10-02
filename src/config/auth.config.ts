import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  bcryptSaltRounds: number;
}

export const AUTH_CONFIG_KEY = 'auth';

const INSECURE_DEVELOPMENT_JWT_SECRET =
  'insecure-development-secret-do-not-use-in-production';

export default registerAs(AUTH_CONFIG_KEY, (): AuthConfig => ({
  jwtSecret: process.env.JWT_SECRET ?? INSECURE_DEVELOPMENT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'ecommerce-api',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
}));
