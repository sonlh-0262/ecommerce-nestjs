import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { definedFields } from '../common/helpers/defined-fields';
import { saveWithUniqueSlug } from '../common/helpers/slug';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { lockUser } from '../users/lock-user';
import { CreateShopBodyDto } from './dto/create-shop.dto';
import { ReviewShopBodyDto } from './dto/review-shop.dto';
import { UpdateShopBodyDto } from './dto/update-shop.dto';
import { Shop } from './entities/shop.entity';
import { ShopStatus } from './enums/shop-status.enum';
import { AdminShopView } from './interfaces/shop-view.interface';
import {
  REASON_MIN_LENGTH,
  RESERVED_SHOP_SLUGS,
  SHOP_RESUBMISSION,
  SLUG_MAX_LENGTH,
  UNIQUE_SHOPS_SLUG_INDEX,
} from './shops.constants';
import { ShopsViewService } from './shops-view.service';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
    private readonly dataSource: DataSource,
    private readonly view: ShopsViewService,
    private readonly mail: MailQueueService,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
  ) {}

  async apply(owner: User, input: CreateShopBodyDto): Promise<Shop> {
    const shop = await saveWithUniqueSlug(
      input.name,
      {
        maxLength: SLUG_MAX_LENGTH,
        constraint: UNIQUE_SHOPS_SLUG_INDEX,
        reserved: RESERVED_SHOP_SLUGS,
        exists: (slug) => this.shopsRepository.existsBy({ slug }),
      },
      (slug) =>
        this.dataSource.transaction(async (manager) => {
          await lockUser(manager, owner.id);

          if (await manager.existsBy(Shop, { ownerId: owner.id })) {
            throw new ConflictException(this.i18n.t('shops.ALREADY_OWNS_SHOP'));
          }

          return manager.save(
            manager.create(Shop, {
              ...input,
              slug,
              ownerId: owner.id,
              description: input.description ?? null,
              status: ShopStatus.Pending,
            }),
          );
        }),
    );

    this.logger.log(`User ${owner.id} applied for shop ${shop.slug}`);

    return shop;
  }

  async updateMine(owner: User, input: UpdateShopBodyDto): Promise<Shop> {
    const shop = await this.dataSource.transaction(async (manager) => {
      const current = await this.lock(manager, { ownerId: owner.id });
      const patch = {
        ...definedFields(input),
        ...(current.status === ShopStatus.Rejected ? SHOP_RESUBMISSION : {}),
      };

      await manager.update(Shop, { id: current.id }, patch);

      return manager.findOneByOrFail(Shop, { id: current.id });
    });

    if (input.name !== undefined) {
      await this.cache.invalidate(CACHE_RESOURCES.products);
    }

    this.logger.log(`User ${owner.id} updated shop ${shop.id}`);

    return shop;
  }

  async review(
    admin: User,
    id: string,
    { status, reason = null }: ReviewShopBodyDto,
  ): Promise<AdminShopView> {
    const shop = await this.dataSource.transaction(async (manager) => {
      const current = await this.lock(manager, { id });

      if (current.status !== ShopStatus.Pending) {
        throw new UnprocessableEntityException(
          this.i18n.t('shops.ALREADY_REVIEWED'),
        );
      }

      if (status === ShopStatus.Rejected && !reason) {
        throw new UnprocessableEntityException(
          this.i18n.t('shops.REASON_REQUIRED', {
            args: { min: REASON_MIN_LENGTH },
          }),
        );
      }

      await manager.update(
        Shop,
        { id },
        {
          status,
          rejectionReason: status === ShopStatus.Rejected ? reason : null,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      );

      return manager.findOneByOrFail(Shop, { id });
    });

    const view = await this.view.adminViewOf(shop);

    await this.mail.enqueue(MAIL_JOB.ShopReviewed, {
      to: view.owner.email,
      fullName: view.owner.fullName,
      shopName: shop.name,
      status,
      reason: shop.rejectionReason,
      lang: MAIL_FALLBACK_LANGUAGE,
    });
    this.logger.log(`Admin ${admin.id} marked shop ${id} ${status}`);

    return view;
  }

  private async lock(
    manager: EntityManager,
    where: FindOptionsWhere<Shop>,
  ): Promise<Shop> {
    const shop = await manager.findOne(Shop, {
      where,
      lock: { mode: 'pessimistic_write' },
    });

    if (!shop) {
      throw new NotFoundException(this.i18n.t('shops.NOT_FOUND'));
    }

    return shop;
  }
}
