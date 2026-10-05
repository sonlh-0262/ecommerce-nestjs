import { activationPatch } from './account-activation';
import { buildUser } from './entities/user.fixture';
import { UserStatus } from './enums/user-status.enum';

describe('activationPatch', () => {
  const AT = new Date('2026-10-05T00:00:00.000Z');

  it('activates a pending account and stamps the verification', () => {
    const user = buildUser({
      status: UserStatus.Pending,
      emailVerifiedAt: null,
    });

    expect(activationPatch(user, AT)).toEqual({
      status: UserStatus.Active,
      emailVerifiedAt: AT,
    });
  });

  it.each([UserStatus.Active, UserStatus.Inactive])(
    'leaves an %s account alone',
    (status) => {
      expect(activationPatch(buildUser({ status }), AT)).toEqual({});
    },
  );
});
