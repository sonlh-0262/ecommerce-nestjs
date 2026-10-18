import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { ProductSuggestion } from '../entities/product-suggestion.entity';
import { SuggestionStatus } from '../enums/suggestion-status.enum';
import {
  AdminSuggestionPage,
  AdminSuggestionView,
  SuggestionAuthor,
  SuggestionPage,
} from '../interfaces/suggestion-view.interface';

export class SuggestionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bình giữ nhiệt inox 1 lít' })
  name: string;

  @ApiProperty({
    example:
      'Loại giữ nóng 12 tiếng, có quai xách, nhiều bạn trong nhóm đang tìm.',
  })
  description: string;

  @ApiProperty({
    nullable: true,
    example: 'https://example.com/binh-giu-nhiet',
  })
  referenceUrl: string | null;

  @ApiProperty({ enum: SuggestionStatus, enumName: 'SuggestionStatus' })
  status: SuggestionStatus;

  @ApiProperty({ nullable: true, example: null })
  adminNote: string | null;

  @ApiProperty({
    nullable: true,
    description: 'When an admin approved or rejected it (ISO 8601).',
    example: null,
  })
  reviewedAt: string | null;

  @ApiProperty({ example: '2026-10-10T08:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-10-10T08:30:00.000Z' })
  updatedAt: string;
}

export class SuggestionResponseDto {
  @ApiProperty({ type: SuggestionDto })
  suggestion: SuggestionDto;
}

export class SuggestionsResponseDto {
  @ApiProperty({ type: [SuggestionDto], description: 'Newest first.' })
  suggestions: SuggestionDto[];

  @ApiProperty({
    description: 'Suggestions matching the filter, across every page.',
    example: 3,
  })
  suggestionsCount: number;
}

export class SuggestionAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'son@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;
}

export class AdminSuggestionDto extends SuggestionDto {
  @ApiProperty({ type: SuggestionAuthorDto })
  user: SuggestionAuthorDto;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Admin who reviewed it, null while PENDING.',
  })
  reviewedBy: string | null;
}

export class AdminSuggestionResponseDto {
  @ApiProperty({ type: AdminSuggestionDto })
  suggestion: AdminSuggestionDto;
}

export class AdminSuggestionsResponseDto {
  @ApiProperty({ type: [AdminSuggestionDto], description: 'Newest first.' })
  suggestions: AdminSuggestionDto[];

  @ApiProperty({
    description: 'Suggestions matching the filter, across every page.',
    example: 42,
  })
  suggestionsCount: number;
}

function toSuggestionDto(suggestion: ProductSuggestion): SuggestionDto {
  return {
    id: suggestion.id,
    name: suggestion.name,
    description: suggestion.description,
    referenceUrl: suggestion.referenceUrl,
    status: suggestion.status,
    adminNote: suggestion.adminNote,
    reviewedAt: suggestion.reviewedAt?.toISOString() ?? null,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
  };
}

function toAuthorDto(author: SuggestionAuthor): SuggestionAuthorDto {
  return {
    id: author.id,
    email: author.email,
    username: author.username,
    fullName: author.fullName,
  };
}

function toAdminSuggestionDto({
  suggestion,
  author,
}: AdminSuggestionView): AdminSuggestionDto {
  return {
    ...toSuggestionDto(suggestion),
    user: toAuthorDto(author),
    reviewedBy: suggestion.reviewedBy,
  };
}

export function toSuggestionResponse(
  suggestion: ProductSuggestion,
): SuggestionResponseDto {
  return { suggestion: toSuggestionDto(suggestion) };
}

export function toSuggestionsResponse(
  page: SuggestionPage,
): SuggestionsResponseDto {
  return paginated(
    'suggestions',
    page.suggestions.map(toSuggestionDto),
    page.total,
  );
}

export function toAdminSuggestionResponse(
  view: AdminSuggestionView,
): AdminSuggestionResponseDto {
  return { suggestion: toAdminSuggestionDto(view) };
}

export function toAdminSuggestionsResponse(
  page: AdminSuggestionPage,
): AdminSuggestionsResponseDto {
  return paginated(
    'suggestions',
    page.suggestions.map(toAdminSuggestionDto),
    page.total,
  );
}
