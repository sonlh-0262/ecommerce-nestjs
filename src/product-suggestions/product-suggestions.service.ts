import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { lockUser } from '../users/lock-user';
import { CreateSuggestionBodyDto } from './dto/create-suggestion.dto';
import { ReviewSuggestionBodyDto } from './dto/review-suggestion.dto';
import { ProductSuggestion } from './entities/product-suggestion.entity';
import { SuggestionStatus } from './enums/suggestion-status.enum';
import { AdminSuggestionView } from './interfaces/suggestion-view.interface';
import { MAX_PENDING_SUGGESTIONS } from './product-suggestions.constants';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';

@Injectable()
export class ProductSuggestionsService {
  private readonly logger = new Logger(ProductSuggestionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly view: ProductSuggestionsViewService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    user: User,
    { name, description, referenceUrl = null }: CreateSuggestionBodyDto,
  ): Promise<ProductSuggestion> {
    const suggestion = await this.dataSource.transaction(async (manager) => {
      await lockUser(manager, user.id);

      const pending = await manager.countBy(ProductSuggestion, {
        userId: user.id,
        status: SuggestionStatus.Pending,
      });

      if (pending >= MAX_PENDING_SUGGESTIONS) {
        throw new ConflictException(
          this.i18n.t('suggestions.TOO_MANY_PENDING', {
            args: { max: MAX_PENDING_SUGGESTIONS },
          }),
        );
      }

      return manager.save(
        manager.create(ProductSuggestion, {
          userId: user.id,
          name,
          description,
          referenceUrl,
          status: SuggestionStatus.Pending,
        }),
      );
    });

    this.logger.log(`User ${user.id} suggested product ${suggestion.id}`);

    return suggestion;
  }

  async review(
    admin: User,
    id: string,
    { status, adminNote = null }: ReviewSuggestionBodyDto,
  ): Promise<AdminSuggestionView> {
    const suggestion = await this.dataSource.transaction(async (manager) => {
      const suggestion = await manager.findOne(ProductSuggestion, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!suggestion) {
        throw new NotFoundException(this.i18n.t('suggestions.NOT_FOUND'));
      }

      if (suggestion.status !== SuggestionStatus.Pending) {
        throw new UnprocessableEntityException(
          this.i18n.t('suggestions.ALREADY_REVIEWED'),
        );
      }

      if (status === SuggestionStatus.Rejected && !adminNote) {
        throw new UnprocessableEntityException(
          this.i18n.t('suggestions.NOTE_REQUIRED'),
        );
      }

      await manager.update(
        ProductSuggestion,
        { id },
        { status, adminNote, reviewedBy: admin.id, reviewedAt: new Date() },
      );

      return manager.findOneByOrFail(ProductSuggestion, { id });
    });

    this.logger.log(`Admin ${admin.id} marked suggestion ${id} ${status}`);

    return this.view.adminViewOf(suggestion);
  }
}
