import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { ProductSuggestion } from './entities/product-suggestion.entity';
import { ProductSuggestionsAdminController } from './product-suggestions-admin.controller';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';
import { ProductSuggestionsController } from './product-suggestions.controller';
import { ProductSuggestionsService } from './product-suggestions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductSuggestion, User])],
  controllers: [
    ProductSuggestionsController,
    ProductSuggestionsAdminController,
  ],
  providers: [ProductSuggestionsService, ProductSuggestionsViewService],
})
export class ProductSuggestionsModule {}
