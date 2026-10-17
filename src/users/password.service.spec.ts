import { ConfigService } from '@nestjs/config';

import { AUTH_CONFIG_KEY } from '../config/auth.config';
import { MIN_BCRYPT_SALT_ROUNDS } from '../config/config.constants';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService({
    getOrThrow: (key: string) =>
      key === AUTH_CONFIG_KEY
        ? { bcryptSaltRounds: MIN_BCRYPT_SALT_ROUNDS }
        : undefined,
  } as unknown as ConfigService);

  it('hashes with the configured cost and never returns the plain text', async () => {
    const hash = await service.hash('Secret123');

    expect(hash).not.toContain('Secret123');
    expect(hash).toMatch(
      new RegExp(`^\\$2[aby]\\$0?${MIN_BCRYPT_SALT_ROUNDS}\\$`),
    );
  });

  it('salts every hash differently', async () => {
    expect(await service.hash('Secret123')).not.toBe(
      await service.hash('Secret123'),
    );
  });

  it('accepts the matching password', async () => {
    const hash = await service.hash('Secret123');

    await expect(service.compare('Secret123', hash)).resolves.toBe(true);
  });

  it('rejects any other password', async () => {
    const hash = await service.hash('Secret123');

    await expect(service.compare('secret123', hash)).resolves.toBe(false);
  });
});
