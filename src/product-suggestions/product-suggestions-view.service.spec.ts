import { In, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { ProductSuggestion } from './entities/product-suggestion.entity';
import { SuggestionStatus } from './enums/suggestion-status.enum';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';

describe('ProductSuggestionsViewService', () => {
  const AUTHORS = [
    { id: 'u1', email: 'an@example.com', username: 'an', fullName: 'An' },
    { id: 'u2', email: 'binh@example.com', username: 'binh', fullName: null },
  ];

  const suggestion = (id: string, userId: string) =>
    ({ id, userId }) as ProductSuggestion;

  const query = (overrides: Partial<SuggestionsQueryDto> = {}) => ({
    limit: 20,
    offset: 0,
    ...overrides,
  });

  const suggestionsRepository = { findAndCount: jest.fn() };
  const usersRepository = { find: jest.fn() };

  const service = new ProductSuggestionsViewService(
    suggestionsRepository as unknown as Repository<ProductSuggestion>,
    usersRepository as unknown as Repository<User>,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the suggestions of the caller, newest first', async () => {
    suggestionsRepository.findAndCount.mockResolvedValue([
      [suggestion('s1', 'u1')],
      7,
    ]);

    await expect(
      service.list(
        'u1',
        query({ status: SuggestionStatus.Pending, offset: 5 }),
      ),
    ).resolves.toEqual({ suggestions: [suggestion('s1', 'u1')], total: 7 });

    expect(suggestionsRepository.findAndCount).toHaveBeenCalledWith({
      where: { userId: 'u1', status: SuggestionStatus.Pending },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 5,
      take: 20,
    });
    expect(usersRepository.find).not.toHaveBeenCalled();
  });

  it('loads every author of an admin page in one query', async () => {
    suggestionsRepository.findAndCount.mockResolvedValue([
      [suggestion('s1', 'u1'), suggestion('s2', 'u2'), suggestion('s3', 'u1')],
      3,
    ]);
    usersRepository.find.mockResolvedValue(AUTHORS);

    const page = await service.adminList(query());

    expect(usersRepository.find).toHaveBeenCalledTimes(1);
    expect(usersRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: In(['u1', 'u2']) },
        withDeleted: true,
      }),
    );
    expect(page.suggestions.map(({ author }) => author.username)).toEqual([
      'an',
      'binh',
      'an',
    ]);
    expect(suggestionsRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: undefined } }),
    );
  });

  it('skips the author query on an empty page', async () => {
    suggestionsRepository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.adminList(query())).resolves.toEqual({
      suggestions: [],
      total: 0,
    });
    expect(usersRepository.find).not.toHaveBeenCalled();
  });

  it('pairs a single suggestion with its author', async () => {
    usersRepository.find.mockResolvedValue([AUTHORS[1]]);

    await expect(service.adminViewOf(suggestion('s2', 'u2'))).resolves.toEqual({
      suggestion: suggestion('s2', 'u2'),
      author: AUTHORS[1],
    });
  });
});
