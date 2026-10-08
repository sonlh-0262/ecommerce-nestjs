import {
  MIN_JWT_SECRET_LENGTH,
  MIN_PRODUCTION_BCRYPT_SALT_ROUNDS,
} from './config.constants';
import { Environment, envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const STRONG_SECRET = 'x'.repeat(MIN_JWT_SECRET_LENGTH);
  const PRODUCTION: Record<string, string> = {
    NODE_ENV: Environment.Production,
    JWT_SECRET: STRONG_SECRET,
    MAIL_HOST: 'smtp.example.com',
    MAIL_PORT: '587',
    MAIL_FROM: 'no-reply@example.com',
    APP_WEB_URL: 'https://shop.example.com',
  };

  const validate = (env: Record<string, string>) =>
    envValidationSchema.validate(env, { abortEarly: false });

  it('accepts an empty environment: every variable has a default', () => {
    expect(validate({}).error).toBeUndefined();
  });

  it('passes through variables it does not know about', () => {
    // Docker injects its own (`CHOKIDAR_USEPOLLING`, `PATH`, ...), so the
    // schema has to be a floor rather than a whitelist.
    expect(validate({ SOMETHING_ELSE: 'x' }).error).toBeUndefined();
  });

  describe('JWT_SECRET', () => {
    it('is required in production', () => {
      const { error } = validate({ NODE_ENV: Environment.Production });

      expect(error?.message).toContain('JWT_SECRET');
    });

    it('is optional outside production, where a default stands in', () => {
      expect(
        validate({ NODE_ENV: Environment.Development }).error,
      ).toBeUndefined();
    });

    it('rejects a secret short enough to brute-force', () => {
      const { error } = validate({ JWT_SECRET: 'too-short' });

      expect(error?.message).toContain('JWT_SECRET');
    });
  });

  describe('BCRYPT_SALT_ROUNDS', () => {
    it('allows a cheap cost factor outside production', () => {
      // Tests and seeders hash a lot and do not need the real cost.
      expect(validate({ BCRYPT_SALT_ROUNDS: '4' }).error).toBeUndefined();
    });

    it('refuses a cheap cost factor in production', () => {
      const { error } = validate({ ...PRODUCTION, BCRYPT_SALT_ROUNDS: '4' });

      expect(error?.message).toContain('BCRYPT_SALT_ROUNDS');
    });

    it('accepts the production floor', () => {
      const { error } = validate({
        ...PRODUCTION,
        BCRYPT_SALT_ROUNDS: String(MIN_PRODUCTION_BCRYPT_SALT_ROUNDS),
      });

      expect(error).toBeUndefined();
    });
  });

  describe('FALLBACK_LANGUAGE', () => {
    it('accepts a language the API ships a catalogue for', () => {
      expect(validate({ FALLBACK_LANGUAGE: 'vi' }).error).toBeUndefined();
    });

    it('rejects one it does not', () => {
      // Otherwise the app boots and silently answers in no language at all.
      const { error } = validate({ FALLBACK_LANGUAGE: 'jp' });

      expect(error?.message).toContain('FALLBACK_LANGUAGE');
    });
  });

  describe('mail and links', () => {
    it.each(['MAIL_HOST', 'MAIL_PORT', 'MAIL_FROM', 'APP_WEB_URL'])(
      'requires %s in production',
      (key) => {
        const { [key]: _omitted, ...withoutKey } = PRODUCTION;

        expect(validate(withoutKey).error?.message).toContain(key);
      },
    );

    it('accepts a complete production mail setup', () => {
      expect(validate(PRODUCTION).error).toBeUndefined();
    });

    it('accepts a sender on a development-only domain', () => {
      expect(
        validate({ MAIL_FROM: 'no-reply@ecommerce.local' }).error,
      ).toBeUndefined();
    });

    it('rejects a sender that is not an email address', () => {
      expect(validate({ MAIL_FROM: 'nobody' }).error?.message).toContain(
        'MAIL_FROM',
      );
    });

    it('rejects a web URL with a trailing slash', () => {
      const { error } = validate({ APP_WEB_URL: 'https://shop.example.com/' });

      expect(error?.message).toContain('APP_WEB_URL');
    });
  });

  describe('THROTTLE_LIMIT', () => {
    it('rejects a limit that would block every request', () => {
      expect(validate({ THROTTLE_LIMIT: '0' }).error?.message).toContain(
        'THROTTLE_LIMIT',
      );
    });
  });

  describe('STORAGE_ROOT', () => {
    it('rejects an empty storage root', () => {
      expect(validate({ STORAGE_ROOT: '' }).error?.message).toContain(
        'STORAGE_ROOT',
      );
    });
  });

  describe('REDIS_DB', () => {
    it('rejects an index outside the 16 Redis provides', () => {
      const { error } = validate({ REDIS_DB: '16' });

      expect(error?.message).toContain('REDIS_DB');
    });
  });
});
