import { User } from '../../users/entities/user.entity';
import { ProductSuggestion } from '../entities/product-suggestion.entity';

export type SuggestionAuthor = Pick<
  User,
  'id' | 'email' | 'username' | 'fullName'
>;

export interface SuggestionPage {
  suggestions: ProductSuggestion[];
  total: number;
}

export interface AdminSuggestionView {
  suggestion: ProductSuggestion;
  author: SuggestionAuthor;
}

export interface AdminSuggestionPage {
  suggestions: AdminSuggestionView[];
  total: number;
}
