import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { ProductSuggestion } from './entities/product-suggestion.entity';
import {
  AdminSuggestionPage,
  AdminSuggestionView,
  SuggestionAuthor,
  SuggestionPage,
} from './interfaces/suggestion-view.interface';

@Injectable()
export class ProductSuggestionsViewService {
  constructor(
    @InjectRepository(ProductSuggestion)
    private readonly suggestionsRepository: Repository<ProductSuggestion>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  list(userId: string, query: SuggestionsQueryDto): Promise<SuggestionPage> {
    return this.page({ userId, status: query.status }, query);
  }

  async adminList(query: SuggestionsQueryDto): Promise<AdminSuggestionPage> {
    const { suggestions, total } = await this.page(
      { status: query.status },
      query,
    );
    const authors = await this.authorsOf(suggestions);

    return {
      suggestions: suggestions.map((suggestion) => ({
        suggestion,
        author: authors.get(suggestion.userId) as SuggestionAuthor,
      })),
      total,
    };
  }

  async adminViewOf(
    suggestion: ProductSuggestion,
  ): Promise<AdminSuggestionView> {
    const authors = await this.authorsOf([suggestion]);

    return {
      suggestion,
      author: authors.get(suggestion.userId) as SuggestionAuthor,
    };
  }

  private async page(
    where: FindOptionsWhere<ProductSuggestion>,
    { limit, offset }: SuggestionsQueryDto,
  ): Promise<SuggestionPage> {
    const [suggestions, total] = await this.suggestionsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { suggestions, total };
  }

  private async authorsOf(
    suggestions: ProductSuggestion[],
  ): Promise<Map<string, SuggestionAuthor>> {
    if (suggestions.length === 0) {
      return new Map();
    }

    const users = await this.usersRepository.find({
      where: { id: In([...new Set(suggestions.map(({ userId }) => userId))]) },
      select: { id: true, email: true, username: true, fullName: true },
      withDeleted: true,
    });

    return new Map(users.map((user) => [user.id, user]));
  }
}
