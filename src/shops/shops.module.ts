import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';
import { Shop } from './entities/shop.entity';
import { ShopsAdminController } from './shops-admin.controller';
import { ShopsViewService } from './shops-view.service';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, User]), MailModule, CacheModule],
  controllers: [ShopsController, ShopsAdminController],
  providers: [ShopsService, ShopsViewService],
  exports: [ShopsViewService],
})
export class ShopsModule {}
