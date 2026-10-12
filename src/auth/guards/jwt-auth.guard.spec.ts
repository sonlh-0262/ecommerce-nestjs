import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';

import { IS_OPTIONAL_AUTH_KEY } from '../../common/decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const i18nMock = { t: jest.fn((key: string) => key) };
  const guard = new JwtAuthGuard(
    new Reflector(),
    i18nMock as unknown as I18nService,
  );

  const passportCanActivate = jest.spyOn(
    Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (context: ExecutionContext) => Promise<boolean>;
    },
    'canActivate',
  );

  const handler = () => undefined;
  class Controller {}

  const contextFor = (isPublic?: boolean): ExecutionContext => {
    Reflect.deleteMetadata(IS_PUBLIC_KEY, handler);

    if (isPublic !== undefined) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, isPublic, handler);
    }

    return {
      getHandler: () => handler,
      getClass: () => Controller,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    passportCanActivate.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    passportCanActivate.mockRestore();
  });

  describe('canActivate', () => {
    it('skips authentication on a @Public() route', async () => {
      expect(await guard.canActivate(contextFor(true))).toBe(true);

      expect(passportCanActivate).not.toHaveBeenCalled();
    });

    it('skips authentication for a whole @Public() controller', async () => {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, Controller);

      try {
        expect(await guard.canActivate(contextFor())).toBe(true);
        expect(passportCanActivate).not.toHaveBeenCalled();
      } finally {
        Reflect.deleteMetadata(IS_PUBLIC_KEY, Controller);
      }
    });

    it('authenticates a route that is not marked public', async () => {
      await guard.canActivate(contextFor());

      expect(passportCanActivate).toHaveBeenCalled();
    });

    it('authenticates a route whose public flag is false', async () => {
      await guard.canActivate(contextFor(false));

      expect(passportCanActivate).toHaveBeenCalled();
    });
  });

  describe('handleRequest', () => {
    it('returns the user Passport resolved', () => {
      const user = { id: 'user-id' };

      expect(guard.handleRequest(null, user, undefined)).toBe(user);
    });

    it('answers a missing or invalid token with 401', () => {
      expect(() => guard.handleRequest(null, false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('keeps the status of a rejection raised by the strategy', () => {
      const locked = new ForbiddenException('auth.ACCOUNT_INACTIVE');

      expect(() => guard.handleRequest(locked, false, undefined)).toThrow(
        locked,
      );
    });

    it('turns a non-Error failure into a 401', () => {
      expect(() => guard.handleRequest('failure', false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    describe('on an @OptionalAuth() route', () => {
      const optional = () => {
        const context = contextFor();
        Reflect.defineMetadata(IS_OPTIONAL_AUTH_KEY, true, handler);

        return context;
      };

      afterEach(() => {
        Reflect.deleteMetadata(IS_OPTIONAL_AUTH_KEY, handler);
      });

      it('lets an anonymous caller through without a user', () => {
        expect(
          guard.handleRequest(null, false, undefined, optional()),
        ).toBeNull();
      });

      it('still returns the user a valid token resolved', () => {
        const user = { id: 'user-id' };

        expect(guard.handleRequest(null, user, undefined, optional())).toBe(
          user,
        );
      });

      it('still refuses a locked account', () => {
        const locked = new ForbiddenException('auth.ACCOUNT_INACTIVE');

        expect(() =>
          guard.handleRequest(locked, false, undefined, optional()),
        ).toThrow(locked);
      });
    });

    it('refuses an anonymous caller on a route without the flag', () => {
      expect(() =>
        guard.handleRequest(null, false, undefined, contextFor()),
      ).toThrow(UnauthorizedException);
    });
  });
});
