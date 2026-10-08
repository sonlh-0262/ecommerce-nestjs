import { buildUser } from '../../users/entities/user.fixture';
import { toAuthenticatedUserResponse } from './authenticated-user.dto';

describe('toAuthenticatedUserResponse', () => {
  const session = { token: 'signed.jwt.token', expiresIn: 86_400 };

  it('wraps the account in the documented envelope', () => {
    const response = toAuthenticatedUserResponse(buildUser(), session);

    expect(Object.keys(response)).toEqual(['user']);
  });

  it('renders timestamps as ISO 8601 strings', () => {
    const { user } = toAuthenticatedUserResponse(buildUser(), session);

    expect(user.createdAt).toBe('2026-09-20T02:00:00.000Z');
    expect(user.emailVerifiedAt).toBe('2026-09-20T02:10:00.000Z');
  });

  it('keeps a missing verification date null rather than undefined', () => {
    const { user } = toAuthenticatedUserResponse(
      buildUser({ emailVerifiedAt: null }),
      session,
    );

    expect(user.emailVerifiedAt).toBeNull();
  });

  it('carries the avatar url it is given', () => {
    const { user } = toAuthenticatedUserResponse(
      buildUser(),
      session,
      '/api/v1/attachments/a1',
    );

    expect(user.avatarUrl).toBe('/api/v1/attachments/a1');
  });

  it('carries the session alongside the account', () => {
    const { user } = toAuthenticatedUserResponse(buildUser(), session);

    expect(user.token).toBe(session.token);
    expect(user.expiresIn).toBe(session.expiresIn);
  });

  it('never exposes the password hash or the deletion marker', () => {
    // The mapper lists its fields explicitly, so this holds by construction -
    // the test is here to fail if someone ever spreads the entity instead.
    const { user } = toAuthenticatedUserResponse(buildUser(), session);

    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('passwordChangedAt');
    expect(user).not.toHaveProperty('deletedAt');
    expect(user).not.toHaveProperty('updatedAt');
  });

  it('exposes exactly the documented fields', () => {
    const { user } = toAuthenticatedUserResponse(buildUser(), session);

    expect(Object.keys(user).sort()).toEqual(
      [
        'address',
        'avatarUrl',
        'createdAt',
        'email',
        'emailVerifiedAt',
        'expiresIn',
        'fullName',
        'id',
        'phone',
        'role',
        'status',
        'token',
        'username',
      ].sort(),
    );
  });
});
