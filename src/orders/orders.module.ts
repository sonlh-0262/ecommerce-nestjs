import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';
import { ProductsModule } from '../products/products.module';
import { User } from '../users/entities/user.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderCodeService } from './order-code.service';
import { OrderTransitionsService } from './order-transitions.service';
import { OrdersAdminController } from './orders-admin.controller';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersViewService } from './orders-view.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory, User]),
    CartModule,
    ProductsModule,
    MailModule,
  ],
  controllers: [OrdersController, OrdersAdminController],
  providers: [
    OrdersService,
    OrdersAdminService,
    OrdersViewService,
    OrderCodeService,
    OrderTransitionsService,
  ],
})
export class OrdersModule {}
