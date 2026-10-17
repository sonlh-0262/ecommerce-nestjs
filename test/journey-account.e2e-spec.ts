import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { UserResponseDto } from '../src/users/dto/user.dto';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { bearer, loginRequest } from './support/http';
import { PNG_IMAGE } from './support/images';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { AUTH_PATHS, PROFILE_PATHS } from './support/test.constants';

const EMAIL = 'journey.account@example.com';
const FIRST_PASSWORD = 'Journey123';
const CHANGED_PASSWORD = 'Changed456';
const RESET_PASSWORD = 'ResetAgain789';

describe('Account journey (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.reset();
    await ctx.close();
  });

  const login = (password: string) =>
    loginRequest(ctx.server(), EMAIL, password);

  const tokenOf = (body: unknown) =>
    (body as AuthenticatedUserResponseDto).user.token;

  const me = (bearerToken = token) =>
    request(ctx.server())
      .get(PROFILE_PATHS.me)
      .set(...bearer(bearerToken));

  const mailNames = () => ctx.mail.sent.map(({ name }) => name);

  it('registers a pending account and queues the activation mail', async () => {
    const response = await request(ctx.server())
      .post(AUTH_PATHS.register)
      .send({
        user: {
          email: EMAIL,
          username: 'journey_account',
          password: FIRST_PASSWORD,
          fullName: 'Journey Account',
        },
      })
      .expect(201);

    expect((response.body as UserResponseDto).user.status).toBe(
      UserStatus.Pending,
    );
    expect(mailNames()).toEqual([MAIL_JOB.VerifyEmail]);
    await login(FIRST_PASSWORD).expect(403);
  });

  it('activates the account with the mailed token, then logs in', async () => {
    await request(ctx.server())
      .post(AUTH_PATHS.verifyEmail)
      .send({ token: ctx.mail.tokenSentTo(EMAIL, MAIL_JOB.VerifyEmail) })
      .expect(200);

    const response = await login(FIRST_PASSWORD).expect(200);

    token = tokenOf(response.body);
    expect((response.body as AuthenticatedUserResponseDto).user.status).toBe(
      UserStatus.Active,
    );
  });

  it('reads the profile', async () => {
    const response = await me().expect(200);

    expect((response.body as UserResponseDto).user).toMatchObject({
      email: EMAIL,
      fullName: 'Journey Account',
      avatarUrl: null,
    });
  });

  it('edits the profile', async () => {
    await request(ctx.server())
      .patch(PROFILE_PATHS.me)
      .set(...bearer(token))
      .send({ user: { fullName: 'Hành Trình', phone: '0912345678' } })
      .expect(200);

    const response = await me().expect(200);

    expect((response.body as UserResponseDto).user).toMatchObject({
      fullName: 'Hành Trình',
      phone: '0912345678',
    });
  });

  it('uploads an avatar that only a signed-in user can download', async () => {
    await request(ctx.server())
      .post(PROFILE_PATHS.avatar)
      .set(...bearer(token))
      .attach('file', PNG_IMAGE, 'me.png')
      .expect(200);

    const { avatarUrl } = ((await me().expect(200)).body as UserResponseDto)
      .user;

    expect(avatarUrl).toMatch(/^\/api\/v1\/attachments\/[0-9a-f-]{36}$/);
    await request(ctx.server())
      .get(avatarUrl!)
      .set(...bearer(token))
      .expect(200);
    await request(ctx.server()).get(avatarUrl!).expect(401);
    expect(await ctx.storedFiles()).toHaveLength(1);
  });

  it('changes the password, which revokes the token in use', async () => {
    await request(ctx.server())
      .put(PROFILE_PATHS.password)
      .set(...bearer(token))
      .send({
        user: {
          currentPassword: FIRST_PASSWORD,
          newPassword: CHANGED_PASSWORD,
        },
      })
      .expect(200);

    await me().expect(401);
    token = tokenOf((await login(CHANGED_PASSWORD).expect(200)).body);
    await me().expect(200);
  });

  it('resets a forgotten password through the mailed link', async () => {
    await request(ctx.server())
      .post(AUTH_PATHS.forgotPassword)
      .send({ email: EMAIL })
      .expect(200);

    expect(mailNames()).toEqual([MAIL_JOB.VerifyEmail, MAIL_JOB.ResetPassword]);

    await request(ctx.server())
      .post(AUTH_PATHS.resetPassword)
      .send({
        token: ctx.mail.tokenSentTo(EMAIL, MAIL_JOB.ResetPassword),
        password: RESET_PASSWORD,
      })
      .expect(200);

    await me().expect(401);
    await me(tokenOf((await login(RESET_PASSWORD).expect(200)).body)).expect(
      200,
    );
  });
});
