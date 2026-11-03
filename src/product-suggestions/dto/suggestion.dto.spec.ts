import { ProductSuggestion } from '../entities/product-suggestion.entity';
import { SuggestionStatus } from '../enums/suggestion-status.enum';
import {
  toAdminSuggestionResponse,
  toAdminSuggestionsResponse,
  toSuggestionResponse,
  toSuggestionsResponse,
} from './suggestion.dto';

describe('suggestion mappers', () => {
  const CREATED_AT = new Date('2026-10-10T08:30:00.000Z');
  const REVIEWED_AT = new Date('2026-10-11T09:00:00.000Z');
  const AUTHOR = {
    id: 'u1',
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
  };

  const suggestion = {
    id: 's1',
    userId: 'u1',
    name: 'Bình giữ nhiệt',
    description: 'Loại giữ nóng 12 tiếng.',
    referenceUrl: null,
    status: SuggestionStatus.Rejected,
    adminNote: 'Đã có sản phẩm tương tự',
    reviewedBy: 'a1',
    reviewedAt: REVIEWED_AT,
    createdAt: CREATED_AT,
    updatedAt: REVIEWED_AT,
  } as ProductSuggestion;

  const EXPECTED = {
    id: 's1',
    name: 'Bình giữ nhiệt',
    description: 'Loại giữ nóng 12 tiếng.',
    referenceUrl: null,
    status: SuggestionStatus.Rejected,
    adminNote: 'Đã có sản phẩm tương tự',
    reviewedAt: REVIEWED_AT.toISOString(),
    createdAt: CREATED_AT.toISOString(),
    updatedAt: REVIEWED_AT.toISOString(),
  };

  it('shows the author the decision but not who made it', () => {
    expect(toSuggestionResponse(suggestion)).toEqual({ suggestion: EXPECTED });
  });

  it('wraps a page with its count', () => {
    expect(
      toSuggestionsResponse({ suggestions: [suggestion], total: 9 }),
    ).toEqual({ suggestions: [EXPECTED], suggestionsCount: 9 });
  });

  it('adds the author and the reviewer for an admin', () => {
    const view = { suggestion, author: AUTHOR };

    expect(toAdminSuggestionResponse(view)).toEqual({
      suggestion: { ...EXPECTED, user: AUTHOR, reviewedBy: 'a1' },
    });
    expect(
      toAdminSuggestionsResponse({ suggestions: [view], total: 1 }),
    ).toMatchObject({ suggestionsCount: 1 });
  });

  it('reports a pending suggestion as not reviewed', () => {
    expect(
      toSuggestionResponse({
        ...suggestion,
        status: SuggestionStatus.Pending,
        reviewedAt: null,
      }).suggestion.reviewedAt,
    ).toBeNull();
  });
});
