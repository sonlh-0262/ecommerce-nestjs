import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { UserResponseDto } from '../src/users/dto/user.dto';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { errorMessages, loginRequest } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import { ADMIN_ADMINS_PATH, AUTH_PATHS } from './support/test.constants';

const INVITATION = {
  email: 'ops.lead@example.com',
  username: 'ops_lead',
  fullName: 'Ops Lead',
};
const PASSWORD = 'OpsLead123';

describe('Admin invitations (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const invite = (as: SeededUser, body: object = { admin: INVITATION }) =>
    actingAs(ctx, as).post(ADMIN_ADMINS_PATH).send(body);

  const accept = (token: string, password = PASSWORD, query = '') =>
    request(ctx.server())
      .post(`${AUTH_PATHS.acceptInvitation}${query}`)
      .send({ token, password });

  const invitationToken = () =>
    ctx.mail.tokenSentTo(INVITATION.email, MAIL_JOB.AdminInvitation);

  describe('POST /admin/admins', () => {
    it('creates a pending admin and mails an invitation link', async () => {
      const response = await invite(admin).expect(201);
      const { user } = response.body as UserResponseDto;
      const [mail] = ctx.mail.sentTo(
        INVITATION.email,
        MAIL_JOB.AdminInvitation,
      );

      expect(user).toMatchObject({
        email: INVITATION.email,
        username: INVITATION.username,
        role: UserRole.Admin,
        status: UserStatus.Pending,
      });
      expect(mail.payload).toMatchObject({
        fullName: INVITATION.fullName,
        expiresInMinutes: 3 * 24 * 60,
      });
      expect(mail.payload.actionUrl).toMatch(
        /^http:\/\/localhost:3000\/accept-invitation\?token=[0-9a-f]{64}$/,
      );
    });

    it('refuses an email already in use', async () => {
      const existing = await ctx.users.create();

      const response = await invite(admin, {
        admin: { ...INVITATION, email: existing.email },
      }).expect(409);

      expect(errorMessages(response.body)).toEqual([
        'This email is already registered',
      ]);
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('takes no password from the inviting admin', async () => {
      const response = await invite(admin, {
        admin: { ...INVITATION, password: PASSWORD },
      }).expect(400);

      expect(errorMessages(response.body)).toEqual([
        'admin.property password should not exist',
      ]);
    });

    it('is closed to a customer', async () => {
      const customer = await ctx.users.createAuthenticated();

      await invite(customer).expect(403);
    });

    it('cannot log the invited account in before it accepts', async () => {
      await invite(admin).expect(201);

      await loginRequest(ctx.server(), INVITATION.email, PASSWORD).expect(401);
    });
  });

  describe('POST /auth/accept-invitation', () => {
    it('activates the admin, who can then log in with its password', async () => {
      await invite(admin).expect(201);

      const response = await accept(invitationToken()).expect(200);
      const login = await loginRequest(
        ctx.server(),
        INVITATION.email,
        PASSWORD,
      ).expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'Your account is active, you can now log in',
      );
      expect((login.body as AuthenticatedUserResponseDto).user).toMatchObject({
        role: UserRole.Admin,
        status: UserStatus.Active,
      });
    });

    it('lets a link be used once', async () => {
      await invite(admin).expect(201);
      const token = invitationToken();

      await accept(token).expect(200);
      await accept(token, 'Another123').expect(422);
    });

    it('refuses a password reset token', async () => {
      const user = await ctx.users.create();
      await request(ctx.server())
        .post(AUTH_PATHS.forgotPassword)
        .send({ email: user.email })
        .expect(200);

      const response = await accept(
        ctx.mail.tokenSentTo(user.email, MAIL_JOB.ResetPassword),
      ).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'This link is invalid or has expired',
      ]);
    });

    it('validates the password like a registration does', async () => {
      await invite(admin).expect(201);

      await accept(invitationToken(), 'short').expect(400);
    });

    it('answers in Vietnamese', async () => {
      await invite(admin).expect(201);

      const response = await accept(invitationToken(), PASSWORD, '?lang=vi');

      expect((response.body as MessageResponseDto).message).toBe(
        'Tài khoản đã được kích hoạt, bạn có thể đăng nhập',
      );
    });
  });
});
