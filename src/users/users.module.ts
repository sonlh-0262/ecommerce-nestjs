import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsModule } from '../attachments/attachments.module';
import { Order } from '../orders/entities/order.entity';
import { User } from './entities/user.entity';
import { PasswordService } from './password.service';
import { ProfileService } from './profile.service';
import { UserAvatarsService } from './user-avatars.service';
import { UserTokensService } from './user-tokens.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Order]), AttachmentsModule],
  controllers: [UsersController, UsersAdminController],
  providers: [
    UsersService,
    PasswordService,
    UserTokensService,
    ProfileService,
    UserAvatarsService,
    UsersAdminService,
  ],
  exports: [
    UsersService,
    PasswordService,
    UserTokensService,
    UserAvatarsService,
  ],
})
export class UsersModule {}
