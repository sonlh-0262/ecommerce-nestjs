import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { UserResponseDto } from '../src/users/dto/user.dto';
import { UserToken } from '../src/users/entities/user-token.entity';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { UserTokenType } from '../src/users/enums/user-token-type.enum';
import { hashToken } from '../src/users/user-tokens.service';
import { errorMessages, loginRequest } from './support/http';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { AUTH_PATHS } from './support/test.constants';

const PASSWORD = 'Secret123';
const EMAIL = 'new.user@example.com';
const VERIFICATION_SENT =
  'If the email exists and is not yet activated, an activation link has been sent';

describe('Registration (e2e)', () => {
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

  const register = (overrides: Record<string, unknown> = {}) =>
    request(ctx.server())
      .post(AUTH_PATHS.register)
      .send({
        user: {
          email: EMAIL,
          username: 'new_user',
          password: PASSWORD,
          fullName: 'New User',
          ...overrides,
        },
      });

  const verify = (token: string) =>
    request(ctx.server()).post(AUTH_PATHS.verifyEmail).send({ token });

  const resend = (email: string) =>
    request(ctx.server()).post(AUTH_PATHS.resendVerification).send({ email });

  const login = () => loginRequest(ctx.server(), EMAIL, PASSWORD);

  const verificationToken = (email = EMAIL) =>
    ctx.mail.tokenSentTo(email, MAIL_JOB.VerifyEmail);

  describe('POST /auth/register', () => {
    it('creates a pending account and returns it without a token', async () => {
      const response = await register().expect(201);
      const { user } = response.body as UserResponseDto;

      expect(user).toMatchObject({
        email: EMAIL,
        username: 'new_user',
        fullName: 'New User',
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });
      expect(response.body).not.toHaveProperty('user.token');
    });

    it('queues an activation link pointing at the web app', async () => {
      await register().expect(201);

      const [mail] = ctx.mail.sentTo(EMAIL, MAIL_JOB.VerifyEmail);

      expect(mail.payload).toMatchObject({ to: EMAIL, fullName: 'New User' });
      expect(mail.payload.actionUrl).toMatch(
        /^http:\/\/localhost:3000\/verify-email\?token=[0-9a-f]{64}$/,
      );
    });

    it('stores only the hash of the emailed token', async () => {
      await register().expect(201);
      const token = verificationToken();

      const [stored] = await ctx.dataSource.getRepository(UserToken).find();

      expect(stored.type).toBe(UserTokenType.EmailVerify);
      expect(stored.tokenHash).toBe(hashToken(token));
      expect(stored.tokenHash).not.toBe(token);
    });

    it('normalises the email before saving it', async () => {
      const response = await register({ email: '  New.User@Example.COM ' });

      expect((response.body as UserResponseDto).user.email).toBe(EMAIL);
    });

    it('rejects an email already registered in another case with 409', async () => {
      await ctx.users.create({ email: EMAIL });

      const response = await register({ email: EMAIL.toUpperCase() }).expect(
        409,
      );

      expect(errorMessages(response.body)).toEqual([
        'This email is already registered',
      ]);
    });

    it('rejects a username already taken with 409', async () => {
      await ctx.users.create({ username: 'new_user' });

      const response = await register().expect(409);

      expect(errorMessages(response.body)).toEqual([
        'This username is already taken',
      ]);
    });

    it('does not queue a mail when registration fails', async () => {
      await ctx.users.create({ email: EMAIL });

      await register().expect(409);

      expect(ctx.mail.sent).toHaveLength(0);
    });

    it.each([
      ['a password without a digit', { password: 'NoDigitsHere' }],
      ['a password without an upper case letter', { password: 'lower123' }],
      ['a password shorter than 8', { password: 'Ab1' }],
      [
        'a password longer than bcrypt reads',
        { password: `Ab1${'x'.repeat(70)}` },
      ],
      ['a username with a space', { username: 'new user' }],
      ['a username shorter than 3', { username: 'ab' }],
      ['an invalid email', { email: 'not-an-email' }],
      ['an unknown field', { role: 'ADMIN' }],
    ])('rejects %s with 400', async (_case, overrides) => {
      const response = await register(overrides).expect(400);

      expect(errorMessages(response.body).length).toBeGreaterThan(0);
    });

    it('translates the validation messages', async () => {
      const response = await request(ctx.server())
        .post(`${AUTH_PATHS.register}?lang=vi`)
        .send({
          user: { email: EMAIL, username: 'new_user', password: 'weakpass' },
        })
        .expect(400);

      expect(errorMessages(response.body)).toEqual([
        'user.password phải có ít nhất một chữ thường, một chữ hoa và một chữ số',
      ]);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('activates the account, which can then log in', async () => {
      await register().expect(201);
      await login().expect(403);

      const response = await verify(verificationToken()).expect(200);
      const { user } = response.body as UserResponseDto;

      expect(user.status).toBe(UserStatus.Active);
      expect(user.emailVerifiedAt).toEqual(expect.any(String));

      const session = await login().expect(200);
      expect((session.body as AuthenticatedUserResponseDto).user.token).toEqual(
        expect.any(String),
      );
    });

    it('refuses a pending account at login with the activation reason', async () => {
      await register().expect(201);

      const response = await login().expect(403);

      expect(errorMessages(response.body)).toEqual([
        'This account has not been activated yet, please confirm your email',
      ]);
    });

    it('accepts a link only once', async () => {
      await register().expect(201);
      const token = verificationToken();

      await verify(token).expect(200);
      const response = await verify(token).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'This link is invalid or has expired',
      ]);
    });

    it('lets only one of two simultaneous redemptions through', async () => {
      await register().expect(201);
      const token = verificationToken();

      const responses = await Promise.all([verify(token), verify(token)]);

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 422]);
    });

    it('rejects an expired link', async () => {
      await register().expect(201);
      const token = verificationToken();
      await ctx.dataSource.query(
        `UPDATE user_tokens
            SET created_at = now() - interval '2 days',
                expires_at = now() - interval '1 day'
          WHERE token_hash = $1`,
        [hashToken(token)],
      );

      await verify(token).expect(422);
    });

    it('rejects a well-formed token nobody issued', async () => {
      await verify('f'.repeat(64)).expect(422);
    });

    it('rejects a reset-password token', async () => {
      const user = await ctx.users.create({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });
      await request(ctx.server())
        .post(AUTH_PATHS.forgotPassword)
        .send({ email: user.email })
        .expect(200);

      await verify(
        ctx.mail.tokenSentTo(user.email, MAIL_JOB.ResetPassword),
      ).expect(422);
    });

    it('rejects a token that is not 64 hex characters with 400', async () => {
      await verify('not-a-token').expect(400);
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('sends a fresh link and retires the previous one', async () => {
      await register().expect(201);
      const first = verificationToken();

      const response = await resend(EMAIL).expect(200);
      const second = verificationToken();

      expect((response.body as MessageResponseDto).message).toBe(
        VERIFICATION_SENT,
      );
      expect(second).not.toBe(first);
      await verify(first).expect(422);
      await verify(second).expect(200);
    });

    it('answers the same for an unknown email and sends nothing', async () => {
      const response = await resend('nobody@example.com').expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        VERIFICATION_SENT,
      );
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('sends nothing to an account that is already active', async () => {
      const user = await ctx.users.create();

      await resend(user.email).expect(200);

      expect(ctx.mail.sent).toHaveLength(0);
    });
  });

  describe('rate limiting', () => {
    it('refuses a sixth registration from one client within the window', async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await register({
          email: `user-${attempt}@example.com`,
          username: `user_${attempt}`,
        }).expect(201);
      }

      const response = await register().expect(429);

      expect(errorMessages(response.body)).toEqual([
        'Too many requests, please try again later',
      ]);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('counts resend requests per email', async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await resend(EMAIL).expect(200);
      }

      await resend(EMAIL).expect(429);
      await resend('other@example.com').expect(200);
    });
  });
});
