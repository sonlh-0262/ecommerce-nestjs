import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { User } from '../src/users/entities/user.entity';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { hashToken } from '../src/users/user-tokens.service';
import { bearer, errorMessages, loginRequest } from './support/http';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { AUTH_PATHS, SEEDED_USER_PASSWORD } from './support/test.constants';

const NEW_PASSWORD = 'BrandNew456';
const RESET_LINK_SENT =
  'If the email exists, a password reset link has been sent';

describe('Password reset (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const forgot = (email: string) =>
    request(ctx.server()).post(AUTH_PATHS.forgotPassword).send({ email });

  const reset = (token: string, password = NEW_PASSWORD) =>
    request(ctx.server())
      .post(AUTH_PATHS.resetPassword)
      .send({ token, password });

  const login = (email: string, password: string) =>
    loginRequest(ctx.server(), email, password);

  const resetToken = async (user: User): Promise<string> => {
    await forgot(user.email).expect(200);

    return ctx.mail.tokenSentTo(user.email, MAIL_JOB.ResetPassword);
  };

  describe('POST /auth/forgot-password', () => {
    it('queues a reset link for a registered email', async () => {
      const user = await ctx.users.create();

      const response = await forgot(user.email).expect(200);
      const [mail] = ctx.mail.sentTo(user.email, MAIL_JOB.ResetPassword);

      expect((response.body as MessageResponseDto).message).toBe(
        RESET_LINK_SENT,
      );
      expect(mail.payload.actionUrl).toMatch(
        /^http:\/\/localhost:3000\/reset-password\?token=[0-9a-f]{64}$/,
      );
    });

    it('answers the same for an unknown email and queues nothing', async () => {
      const response = await forgot('nobody@example.com').expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        RESET_LINK_SENT,
      );
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('queues nothing for a soft-deleted account', async () => {
      const user = await ctx.users.create();
      await ctx.dataSource.getRepository(User).softDelete({ id: user.id });

      await forgot(user.email).expect(200);

      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('localises the confirmation', async () => {
      const response = await request(ctx.server())
        .post(`${AUTH_PATHS.forgotPassword}?lang=vi`)
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
      );
    });

    it('limits requests per client and email', async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await forgot('nobody@example.com').expect(200);
      }

      await forgot('nobody@example.com').expect(429);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('replaces the password', async () => {
      const user = await ctx.users.create();

      const response = await reset(await resetToken(user)).expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'Your password has been reset, please log in again',
      );
      await login(user.email, SEEDED_USER_PASSWORD).expect(401);
      await login(user.email, NEW_PASSWORD).expect(200);
    });

    it('revokes every token issued before the reset', async () => {
      const { user, session } = await ctx.users.createAuthenticated();
      const token = await resetToken(user);

      await reset(token).expect(200);

      await request(ctx.server())
        .post(AUTH_PATHS.logout)
        .set(...bearer(session.token))
        .expect(401);
    });

    it('accepts a token issued right after the reset', async () => {
      const user = await ctx.users.create();
      await reset(await resetToken(user)).expect(200);

      const response = await login(user.email, NEW_PASSWORD).expect(200);
      const { token } = (response.body as AuthenticatedUserResponseDto).user;

      await request(ctx.server())
        .post(AUTH_PATHS.logout)
        .set(...bearer(token))
        .expect(200);
    });

    it('accepts a link only once', async () => {
      const user = await ctx.users.create();
      const token = await resetToken(user);

      await reset(token).expect(200);
      const response = await reset(token, 'Another789').expect(422);

      expect(errorMessages(response.body)).toEqual([
        'This link is invalid or has expired',
      ]);
    });

    it('retires an earlier link when a new one is requested', async () => {
      const user = await ctx.users.create();
      const first = await resetToken(user);
      const second = await resetToken(user);

      await reset(first).expect(422);
      await reset(second).expect(200);
    });

    it('rejects an expired link', async () => {
      const user = await ctx.users.create();
      const token = await resetToken(user);
      await ctx.dataSource.query(
        `UPDATE user_tokens
            SET created_at = now() - interval '1 hour',
                expires_at = now() - interval '1 minute'
          WHERE token_hash = $1`,
        [hashToken(token)],
      );

      await reset(token).expect(422);
    });

    it('activates a pending account, since the link proves the email', async () => {
      const user = await ctx.users.create({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });

      await reset(await resetToken(user)).expect(200);

      const updated = await ctx.dataSource
        .getRepository(User)
        .findOneByOrFail({ id: user.id });
      expect(updated.status).toBe(UserStatus.Active);
      expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
      await login(user.email, NEW_PASSWORD).expect(200);
    });

    it('keeps a locked account locked', async () => {
      const user = await ctx.users.create({ status: UserStatus.Inactive });

      await reset(await resetToken(user)).expect(200);

      await login(user.email, NEW_PASSWORD).expect(403);
    });

    it('applies the registration password rules', async () => {
      const user = await ctx.users.create();

      await reset(await resetToken(user), 'weakpass').expect(400);
    });
  });
});
