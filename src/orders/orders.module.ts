import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';
import { ProductsModule } from '../products/products.module';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderCodeService } from './order-code.service';
import { OrdersViewService } from './orders-view.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory]),
    CartModule,
    ProductsModule,
    MailModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersViewService, OrderCodeService],
})
export class OrdersModule {}
