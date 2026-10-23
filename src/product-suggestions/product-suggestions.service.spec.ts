import {
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { User } from '../users/entities/user.entity';
import { ProductSuggestion } from './entities/product-suggestion.entity';
import { SuggestionStatus } from './enums/suggestion-status.enum';
import { MAX_PENDING_SUGGESTIONS } from './product-suggestions.constants';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';
import { ProductSuggestionsService } from './product-suggestions.service';

describe('ProductSuggestionsService', () => {
  const USER = { id: 'u1' } as User;
  const ADMIN = { id: 'a1' } as User;
  const INPUT = {
    name: 'Bình giữ nhiệt',
    description: 'Loại giữ nóng 12 tiếng, có quai xách.',
  };

  const pending = (overrides: Partial<ProductSuggestion> = {}) =>
    ({
      id: 's1',
      userId: USER.id,
      status: SuggestionStatus.Pending,
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      ...overrides,
    }) as ProductSuggestion;

  const managerMock = {
    findOne: jest.fn(),
    countBy: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn((value: object) => Promise.resolve({ id: 's1', ...value })),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const viewMock = {
    adminViewOf: jest.fn((suggestion: ProductSuggestion) =>
      Promise.resolve({ suggestion, author: { id: USER.id } }),
    ),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ProductSuggestionsService(
    dataSource,
    viewMock as unknown as ProductSuggestionsViewService,
    i18nMock as unknown as I18nService,
  );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('locks the author, then stores a PENDING suggestion', async () => {
      managerMock.countBy.mockResolvedValue(MAX_PENDING_SUGGESTIONS - 1);

      await expect(service.create(USER, INPUT)).resolves.toMatchObject({
        id: 's1',
        status: SuggestionStatus.Pending,
        referenceUrl: null,
      });

      expect(managerMock.findOne).toHaveBeenCalledWith(User, {
        where: { id: USER.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.countBy).toHaveBeenCalledWith(ProductSuggestion, {
        userId: USER.id,
        status: SuggestionStatus.Pending,
      });
    });

    it(`refuses a suggestion past ${MAX_PENDING_SUGGESTIONS} pending with 409`, async () => {
      managerMock.countBy.mockResolvedValue(MAX_PENDING_SUGGESTIONS);

      await expect(service.create(USER, INPUT)).rejects.toThrow(
        new ConflictException('suggestions.TOO_MANY_PENDING'),
      );
      expect(i18nMock.t).toHaveBeenCalledWith('suggestions.TOO_MANY_PENDING', {
        args: { max: MAX_PENDING_SUGGESTIONS },
      });
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });

  describe('review', () => {
    it('answers 404 for an unknown suggestion', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.review(ADMIN, 's1', { status: SuggestionStatus.Approved }),
      ).rejects.toThrow(new NotFoundException('suggestions.NOT_FOUND'));
    });

    it.each([SuggestionStatus.Approved, SuggestionStatus.Rejected])(
      'refuses to review a suggestion already %s',
      async (status) => {
        managerMock.findOne.mockResolvedValue(pending({ status }));

        await expect(
          service.review(ADMIN, 's1', { status: SuggestionStatus.Approved }),
        ).rejects.toThrow(
          new UnprocessableEntityException('suggestions.ALREADY_REVIEWED'),
        );
        expect(managerMock.update).not.toHaveBeenCalled();
      },
    );

    it('needs a note to reject', async () => {
      managerMock.findOne.mockResolvedValue(pending());

      await expect(
        service.review(ADMIN, 's1', { status: SuggestionStatus.Rejected }),
      ).rejects.toThrow(
        new UnprocessableEntityException('suggestions.NOTE_REQUIRED'),
      );
    });

    it('records who reviewed it and when, then returns the stored row', async () => {
      const stored = pending({
        status: SuggestionStatus.Rejected,
        reviewedBy: ADMIN.id,
      });

      managerMock.findOne.mockResolvedValue(pending());
      managerMock.findOneByOrFail.mockResolvedValue(stored);

      const { suggestion } = await service.review(ADMIN, 's1', {
        status: SuggestionStatus.Rejected,
        adminNote: 'Đã có sản phẩm tương tự',
      });

      expect(managerMock.update).toHaveBeenCalledWith(
        ProductSuggestion,
        { id: 's1' },
        {
          status: SuggestionStatus.Rejected,
          adminNote: 'Đã có sản phẩm tương tự',
          reviewedBy: ADMIN.id,
          reviewedAt: expect.any(Date) as Date,
        },
      );
      expect(managerMock.findOneByOrFail).toHaveBeenCalledWith(
        ProductSuggestion,
        { id: 's1' },
      );
      expect(suggestion).toBe(stored);
      expect(viewMock.adminViewOf).toHaveBeenCalledWith(stored);
    });

    it('approves without a note', async () => {
      managerMock.findOne.mockResolvedValue(pending());

      await service.review(ADMIN, 's1', { status: SuggestionStatus.Approved });

      expect(managerMock.update).toHaveBeenCalledWith(
        ProductSuggestion,
        { id: 's1' },
        expect.objectContaining({
          status: SuggestionStatus.Approved,
          adminNote: null,
        }),
      );
    });
  });
});
