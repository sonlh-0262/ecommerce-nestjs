import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { User } from '../src/users/entities/user.entity';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { errorMessages, loginRequest } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { AUTH_PATHS, SEEDED_USER_PASSWORD } from './support/test.constants';

/** Both arms of a failed login have to answer with exactly this. */
const EN_INVALID_CREDENTIALS = 'Email or password is incorrect';

describe('Auth (e2e)', () => {
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

  const login = (email: string, password: string, query = '') =>
    loginRequest(ctx.server(), email, password, query);

  const loginAs = (user: User, query = '') =>
    login(user.email, SEEDED_USER_PASSWORD, query);

  describe('POST /auth/login', () => {
    it('returns the account and a session for the right password', async () => {
      const user = await ctx.users.create();

      const response = await loginAs(user).expect(200);
      const { user: body } = response.body as AuthenticatedUserResponseDto;

      expect(body.id).toBe(user.id);
      expect(body.email).toBe(user.email);
      expect(body.status).toBe(UserStatus.Active);
      expect(body.token).toEqual(expect.any(String));
      expect(body.expiresIn).toBeGreaterThan(0);
    });

    it('answers 200, not 201: logging in creates no resource', async () => {
      const user = await ctx.users.create();

      await loginAs(user).expect(200);
    });

    it('never returns the password hash', async () => {
      const user = await ctx.users.create();

      const response = await loginAs(user).expect(200);

      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain(user.passwordHash);
    });

    it('accepts the email in a different case', async () => {
      // `UQ_users_email` indexes `lower(email)`, so the lookup has to match
      // the same way or this request would 401.
      const user = await ctx.users.create();

      await login(user.email.toUpperCase(), SEEDED_USER_PASSWORD).expect(200);
    });

    it('trims surrounding whitespace off the email', async () => {
      const user = await ctx.users.create();

      await login(`  ${user.email}  `, SEEDED_USER_PASSWORD).expect(200);
    });

    it('rejects a wrong password with 401', async () => {
      const user = await ctx.users.create();

      const response = await login(user.email, 'WrongPassword@1').expect(401);

      expect(errorMessages(response.body)).toEqual([EN_INVALID_CREDENTIALS]);
    });

    it('rejects an unknown email with the very same 401', async () => {
      // Any difference here - status, message, or timing - turns login into a
      // way of discovering which addresses are registered.
      const response = await login(
        'nobody@example.com',
        SEEDED_USER_PASSWORD,
      ).expect(401);

      expect(errorMessages(response.body)).toEqual([EN_INVALID_CREDENTIALS]);
    });

    it('rejects an account that has not been activated with 403', async () => {
      const user = await ctx.users.create({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });

      await loginAs(user).expect(403);
    });

    it('rejects a locked account with 403', async () => {
      const user = await ctx.users.create({ status: UserStatus.Inactive });

      await loginAs(user).expect(403);
    });

    it('hides the status of a locked account behind a wrong password', async () => {
      const user = await ctx.users.create({ status: UserStatus.Inactive });

      await login(user.email, 'WrongPassword@1').expect(401);
    });

    it('rejects a soft-deleted account with 401', async () => {
      const user = await ctx.users.create();
      await ctx.dataSource.getRepository(User).softDelete({ id: user.id });

      await loginAs(user).expect(401);
    });

    it('localises the rejection', async () => {
      const response = await login(
        'nobody@example.com',
        SEEDED_USER_PASSWORD,
        '?lang=vi',
      ).expect(401);

      expect(errorMessages(response.body)).toEqual([
        'Email hoặc mật khẩu không đúng',
      ]);
    });

    describe('validation', () => {
      it('rejects a body without the user envelope', async () => {
        await request(ctx.server())
          .post(AUTH_PATHS.login)
          .send({ email: 'son@example.com', password: SEEDED_USER_PASSWORD })
          .expect(400);
      });

      it('rejects a malformed email', async () => {
        await login('not-an-email', SEEDED_USER_PASSWORD).expect(400);
      });

      it('rejects an empty password', async () => {
        await login('son@example.com', '').expect(400);
      });

      it('rejects an unknown field inside the envelope', async () => {
        await request(ctx.server())
          .post(AUTH_PATHS.login)
          .send({
            user: {
              email: 'son@example.com',
              password: SEEDED_USER_PASSWORD,
              role: 'ADMIN',
            },
          })
          .expect(400);
      });

      it('translates validation errors', async () => {
        const response = await login(
          'not-an-email',
          SEEDED_USER_PASSWORD,
          '?lang=vi',
        ).expect(400);

        expect(JSON.stringify(response.body)).toContain('email hợp lệ');
      });
    });
  });

  describe('POST /auth/logout', () => {
    const logout = (token?: string) => {
      const pending = request(ctx.server()).post(AUTH_PATHS.logout);

      return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
    };

    let seeded: SeededUser;

    beforeEach(async () => {
      seeded = await ctx.users.createAuthenticated();
    });

    it('revokes the token it was called with', async () => {
      const response = await logout(seeded.session.token).expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'You have been logged out',
      );
    });

    it('refuses the same token afterwards', async () => {
      await logout(seeded.session.token).expect(200);

      await logout(seeded.session.token).expect(401);
    });

    it('leaves other sessions of the same account alone', async () => {
      // The denylist is keyed by token id, not by account: logging out of one
      // device must not sign the user out everywhere.
      const other = await loginAs(seeded.user).expect(200);
      const otherToken = (other.body as AuthenticatedUserResponseDto).user
        .token;

      await logout(seeded.session.token).expect(200);

      await logout(otherToken).expect(200);
    });

    it('rejects a request with no token', async () => {
      await logout().expect(401);
    });

    it('rejects a token that is not a JWT', async () => {
      await logout('not-a-token').expect(401);
    });

    it('rejects a token signed for a deleted account', async () => {
      await ctx.dataSource
        .getRepository(User)
        .softDelete({ id: seeded.user.id });

      await logout(seeded.session.token).expect(401);
    });

    it('rejects a token issued before the password changed', async () => {
      // One write revokes every live session, which the denylist cannot do:
      // the ids of tokens already in the wild are unknown.
      await ctx.dataSource
        .getRepository(User)
        .update({ id: seeded.user.id }, { passwordChangedAt: new Date() });

      await logout(seeded.session.token).expect(401);
    });

    it('rejects a token whose account was locked after it was issued', async () => {
      await ctx.dataSource
        .getRepository(User)
        .update({ id: seeded.user.id }, { status: UserStatus.Inactive });

      await logout(seeded.session.token).expect(403);
    });
  });
});
