import request from 'supertest';

import { MAX_FILE_SIZE } from '../src/attachments/attachments.constants';
import { Attachment } from '../src/attachments/entities/attachment.entity';
import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { UserResponseDto } from '../src/users/dto/user.dto';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { bearer, errorMessages, loginRequest } from './support/http';
import { PDF_DOCUMENT, PNG_IMAGE } from './support/images';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import {
  AUTH_PATHS,
  PROFILE_PATHS,
  SEEDED_USER_PASSWORD,
} from './support/test.constants';

const NEW_PASSWORD = 'BrandNew456';

describe('Profile (e2e)', () => {
  let ctx: TestContext;
  let me: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    me = await ctx.users.createAuthenticated();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const getProfile = (token = me.session.token) =>
    request(ctx.server())
      .get(PROFILE_PATHS.me)
      .set(...bearer(token));

  const patchProfile = (user: Record<string, unknown>, query = '') =>
    request(ctx.server())
      .patch(`${PROFILE_PATHS.me}${query}`)
      .set(...bearer(me.session.token))
      .send({ user });

  const changePassword = (
    currentPassword: string,
    newPassword = NEW_PASSWORD,
  ) =>
    request(ctx.server())
      .put(PROFILE_PATHS.password)
      .set(...bearer(me.session.token))
      .send({ user: { currentPassword, newPassword } });

  const uploadAvatar = (contents: Buffer, fileName = 'me.png') =>
    request(ctx.server())
      .post(PROFILE_PATHS.avatar)
      .set(...bearer(me.session.token))
      .attach('file', contents, fileName);

  const avatarRows = () =>
    ctx.dataSource
      .getRepository(Attachment)
      .countBy({ attachableId: me.user.id });

  const avatarUrlOf = (body: unknown): string | null =>
    (body as UserResponseDto).user.avatarUrl;

  describe('GET /users/me', () => {
    it('returns the account the token belongs to', async () => {
      const response = await getProfile().expect(200);
      const { user } = response.body as UserResponseDto;

      expect(user).toMatchObject({
        id: me.user.id,
        email: me.user.email,
        username: me.user.username,
        avatarUrl: null,
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('requires a token', async () => {
      await request(ctx.server()).get(PROFILE_PATHS.me).expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('changes only the fields sent', async () => {
      const response = await patchProfile({
        fullName: '  New Name  ',
        phone: '+84 (90) 123-4567',
      }).expect(200);

      expect((response.body as UserResponseDto).user).toMatchObject({
        fullName: 'New Name',
        phone: '+84 (90) 123-4567',
        address: me.user.address ?? null,
        username: me.user.username,
      });
    });

    it('clears a field sent as null or blank', async () => {
      await patchProfile({ phone: '0901234567', address: 'Ha Noi' }).expect(
        200,
      );

      const response = await patchProfile({ phone: null, address: '  ' });

      expect((response.body as UserResponseDto).user).toMatchObject({
        phone: null,
        address: null,
      });
    });

    it('persists the change', async () => {
      await patchProfile({ username: 'renamed_user' }).expect(200);

      const response = await getProfile().expect(200);

      expect((response.body as UserResponseDto).user.username).toBe(
        'renamed_user',
      );
    });

    it('rejects a username another account holds with 409', async () => {
      const other = await ctx.users.create();

      const response = await patchProfile(
        { username: other.username },
        '?lang=vi',
      ).expect(409);

      expect(errorMessages(response.body)).toEqual([
        'Tên đăng nhập này đã được sử dụng',
      ]);
    });

    it('accepts the username the account already has', async () => {
      await patchProfile({ username: me.user.username }).expect(200);
    });

    it('rejects an empty change with 400', async () => {
      const response = await patchProfile({}).expect(400);

      expect(errorMessages(response.body)).toEqual([
        'user must contain at least one field',
      ]);
    });

    it.each([
      ['email', { email: 'new@example.com' }],
      ['role', { role: 'ADMIN' }],
      ['status', { status: 'ACTIVE' }],
    ])('refuses to change the %s', async (_field, user) => {
      await patchProfile(user).expect(400);
    });

    it('refuses a null username', async () => {
      await patchProfile({ username: null }).expect(400);
    });

    it('rejects a phone number with letters', async () => {
      const response = await patchProfile({ phone: 'call me' }).expect(400);

      expect(errorMessages(response.body)).toEqual([
        'user.phone may only contain digits, spaces and + - ( )',
      ]);
    });
  });

  describe('PUT /users/me/password', () => {
    it('changes the password', async () => {
      const response = await changePassword(SEEDED_USER_PASSWORD).expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'Your password has been changed, please log in again',
      );
      await loginRequest(
        ctx.server(),
        me.user.email,
        SEEDED_USER_PASSWORD,
      ).expect(401);
      await loginRequest(ctx.server(), me.user.email, NEW_PASSWORD).expect(200);
    });

    it('revokes the token used for the change', async () => {
      await changePassword(SEEDED_USER_PASSWORD).expect(200);

      await getProfile().expect(401);
    });

    it('rejects a wrong current password with 401 and keeps the token', async () => {
      const response = await changePassword('WrongPassword1').expect(401);

      expect(errorMessages(response.body)).toEqual([
        'The current password is incorrect',
      ]);
      await getProfile().expect(200);
    });

    it('retires a reset link sent before the change', async () => {
      await request(ctx.server())
        .post(AUTH_PATHS.forgotPassword)
        .send({ email: me.user.email })
        .expect(200);
      const token = ctx.mail.tokenSentTo(me.user.email, MAIL_JOB.ResetPassword);

      await changePassword(SEEDED_USER_PASSWORD).expect(200);

      await request(ctx.server())
        .post(AUTH_PATHS.resetPassword)
        .send({ token, password: 'Another789' })
        .expect(422);
    });

    it('rejects the current password as the new one with 422', async () => {
      await changePassword(SEEDED_USER_PASSWORD, SEEDED_USER_PASSWORD).expect(
        422,
      );
    });

    it('applies the registration password rules', async () => {
      await changePassword(SEEDED_USER_PASSWORD, 'short').expect(400);
    });

    it('limits how often the current password can be guessed', async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await changePassword('WrongPassword1').expect(401);
      }

      await changePassword('WrongPassword1').expect(429);
    });
  });

  describe('POST /users/me/avatar', () => {
    it('stores the avatar and shows it on the profile', async () => {
      const upload = await uploadAvatar(PNG_IMAGE).expect(200);
      const avatarUrl = avatarUrlOf(upload.body);

      expect(avatarUrl).toMatch(/^\/api\/v1\/attachments\/[0-9a-f-]{36}$/);

      const profile = await getProfile().expect(200);
      expect(avatarUrlOf(profile.body)).toBe(avatarUrl);

      await request(ctx.server())
        .get(avatarUrl!)
        .set(...bearer(me.session.token))
        .expect(200)
        .expect('Content-Type', 'image/png');
    });

    it('refuses to serve the avatar without a token', async () => {
      const upload = await uploadAvatar(PNG_IMAGE).expect(200);

      await request(ctx.server()).get(avatarUrlOf(upload.body)!).expect(401);
    });

    it('returns the avatar on login', async () => {
      const upload = await uploadAvatar(PNG_IMAGE).expect(200);

      const response = await loginRequest(
        ctx.server(),
        me.user.email,
        SEEDED_USER_PASSWORD,
      ).expect(200);

      expect(
        (response.body as AuthenticatedUserResponseDto).user.avatarUrl,
      ).toBe(avatarUrlOf(upload.body));
    });

    it('replaces the previous avatar and deletes its file', async () => {
      const first = await uploadAvatar(PNG_IMAGE).expect(200);
      const second = await uploadAvatar(PNG_IMAGE).expect(200);

      expect(avatarUrlOf(second.body)).not.toBe(avatarUrlOf(first.body));
      await expect(avatarRows()).resolves.toBe(1);
      await expect(ctx.storedFiles()).resolves.toHaveLength(1);
      await request(ctx.server())
        .get(avatarUrlOf(first.body)!)
        .set(...bearer(me.session.token))
        .expect(404);
    });

    it('keeps the old avatar when the new upload is refused', async () => {
      const first = await uploadAvatar(PNG_IMAGE).expect(200);

      const response = await uploadAvatar(PDF_DOCUMENT, 'cv.png').expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Only JPEG, PNG and WebP images are accepted',
      ]);
      await expect(avatarRows()).resolves.toBe(1);
      await expect(ctx.storedFiles()).resolves.toHaveLength(1);
      await request(ctx.server())
        .get(avatarUrlOf(first.body)!)
        .set(...bearer(me.session.token))
        .expect(200);
    });

    it('rejects a file over the limit with a translated 413', async () => {
      const tooLarge = Buffer.concat([PNG_IMAGE, Buffer.alloc(MAX_FILE_SIZE)]);

      const response = await request(ctx.server())
        .post(`${PROFILE_PATHS.avatar}?lang=vi`)
        .set(...bearer(me.session.token))
        .attach('file', tooLarge, 'big.png')
        .expect(413);

      expect(errorMessages(response.body)).toEqual([
        'Tệp vượt quá giới hạn 2 MB',
      ]);
      await expect(avatarRows()).resolves.toBe(0);
    });

    it('rejects a request without a file with 400', async () => {
      const response = await request(ctx.server())
        .post(PROFILE_PATHS.avatar)
        .set(...bearer(me.session.token))
        .expect(400);

      expect(errorMessages(response.body)).toEqual(['Please attach a file']);
    });

    it.each([
      [
        'a file under another field',
        (req: request.Test) => req.attach('avatar', PNG_IMAGE, 'me.png'),
      ],
      [
        'a text field next to the file',
        (req: request.Test) =>
          req.field('note', 'x').attach('file', PNG_IMAGE, 'me.png'),
      ],
    ])('rejects %s with a translated 400', async (_case, build) => {
      const response = await build(
        request(ctx.server())
          .post(`${PROFILE_PATHS.avatar}?lang=vi`)
          .set(...bearer(me.session.token)),
      ).expect(400);

      expect(errorMessages(response.body)).toEqual([
        'Chỉ gửi đúng một tệp ảnh trong trường "file"',
      ]);
      await expect(avatarRows()).resolves.toBe(0);
    });

    it('requires a token', async () => {
      await request(ctx.server())
        .post(PROFILE_PATHS.avatar)
        .attach('file', PNG_IMAGE, 'me.png')
        .expect(401);
    });
  });
});
