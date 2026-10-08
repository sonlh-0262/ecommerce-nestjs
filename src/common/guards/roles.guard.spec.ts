import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { buildUser } from '../../users/entities/user.fixture';
import { UserRole } from '../../users/enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const i18nMock = { t: jest.fn((key: string) => key) };
  const guard = new RolesGuard(reflector, i18nMock as unknown as I18nService);

  const handler = () => undefined;
  class Controller {}

  const contextFor = (
    roles: UserRole[] | undefined,
    user?: AuthenticatedUser,
  ): ExecutionContext => {
    Reflect.deleteMetadata(ROLES_KEY, handler);

    if (roles) {
      Reflect.defineMetadata(ROLES_KEY, roles, handler);
    }

    return {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  };

  const signedIn = (role: UserRole): AuthenticatedUser => ({
    user: buildUser({ role }),
    jti: 'token-id',
    expiresAt: 1_790_000_000,
  });

  it('lets any signed-in account through a route without @Roles()', () => {
    expect(
      guard.canActivate(contextFor(undefined, signedIn(UserRole.User))),
    ).toBe(true);
  });

  it('lets through an account holding one of the required roles', () => {
    expect(
      guard.canActivate(contextFor([UserRole.Admin], signedIn(UserRole.Admin))),
    ).toBe(true);
  });

  it('refuses an account without the required role with 403', () => {
    expect(() =>
      guard.canActivate(contextFor([UserRole.Admin], signedIn(UserRole.User))),
    ).toThrow(ForbiddenException);
  });

  it('gives the refusal a translated message', () => {
    expect(() =>
      guard.canActivate(contextFor([UserRole.Admin], signedIn(UserRole.User))),
    ).toThrow('common.FORBIDDEN');
  });

  it('refuses a role-restricted route that has no account on the request', () => {
    expect(() => guard.canActivate(contextFor([UserRole.Admin]))).toThrow(
      ForbiddenException,
    );
  });

  it('treats an empty role list as no restriction', () => {
    expect(guard.canActivate(contextFor([], signedIn(UserRole.User)))).toBe(
      true,
    );
  });
});
