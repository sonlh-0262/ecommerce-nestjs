import { randomUUID } from 'crypto';

import {
  AdminSuggestionResponseDto,
  AdminSuggestionsResponseDto,
  SuggestionResponseDto,
  SuggestionsResponseDto,
} from '../src/product-suggestions/dto/suggestion.dto';
import { SuggestionStatus } from '../src/product-suggestions/enums/suggestion-status.enum';
import { MAX_PENDING_SUGGESTIONS } from '../src/product-suggestions/product-suggestions.constants';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_SUGGESTIONS_PATH,
  SUGGESTIONS_PATH,
  TEST_SUGGESTION,
} from './support/test.constants';

describe('Product suggestions (e2e)', () => {
  const NOTE = 'Đã có sản phẩm tương tự trong danh mục Gia dụng';

  let ctx: TestContext;
  let admin: SeededUser;
  let author: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    author = await ctx.users.createAuthenticated({ fullName: 'Lanh Hung Son' });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const suggest = (user: SeededUser, suggestion: object = TEST_SUGGESTION) =>
    actingAs(ctx, user).post(SUGGESTIONS_PATH).send({ suggestion });

  const suggested = async (user: SeededUser = author) =>
    ((await suggest(user).expect(201)).body as SuggestionResponseDto)
      .suggestion;

  const review = (id: string, suggestion: object, query = '') =>
    actingAs(ctx, admin)
      .patch(`${ADMIN_SUGGESTIONS_PATH}/${id}${query}`)
      .send({ suggestion });

  describe('POST /product-suggestions', () => {
    it('stores a PENDING suggestion with trimmed fields', async () => {
      const response = await suggest(author, {
        name: '  Bình giữ nhiệt  ',
        description: TEST_SUGGESTION.description,
        referenceUrl: ' https://example.com/binh ',
      }).expect(201);

      expect((response.body as SuggestionResponseDto).suggestion).toMatchObject(
        {
          name: 'Bình giữ nhiệt',
          referenceUrl: 'https://example.com/binh',
          status: SuggestionStatus.Pending,
          adminNote: null,
          reviewedAt: null,
        },
      );
    });

    it(`refuses a suggestion past ${MAX_PENDING_SUGGESTIONS} pending with 409`, async () => {
      for (let index = 0; index < MAX_PENDING_SUGGESTIONS; index += 1) {
        await suggested();
      }

      const response = await actingAs(ctx, author)
        .post(`${SUGGESTIONS_PATH}?lang=vi`)
        .send({ suggestion: TEST_SUGGESTION })
        .expect(409);

      expect(errorMessages(response.body)).toEqual([
        `Bạn đang có ${MAX_PENDING_SUGGESTIONS} gợi ý chờ duyệt`,
      ]);
    });

    it('frees a slot once a suggestion is reviewed', async () => {
      const ids: string[] = [];

      for (let index = 0; index < MAX_PENDING_SUGGESTIONS; index += 1) {
        ids.push((await suggested()).id);
      }

      await review(ids[0], { status: SuggestionStatus.Approved }).expect(200);

      await suggest(author).expect(201);
    });

    it.each([
      ['a short description', { description: 'quá ngắn' }],
      ['an empty name', { name: '   ' }],
      ['a reference that is not a web link', { referenceUrl: 'ftp://x.com' }],
    ])('refuses %s with 400', async (_case, overrides) => {
      await suggest(author, { ...TEST_SUGGESTION, ...overrides }).expect(400);
    });
  });

  describe('GET /product-suggestions', () => {
    it('lists only my own suggestions', async () => {
      const stranger = await ctx.users.createAuthenticated();
      const mine = await suggested();

      await suggested(stranger);

      const response = await actingAs(ctx, author)
        .get(SUGGESTIONS_PATH)
        .expect(200);
      const body = response.body as SuggestionsResponseDto;

      expect(body.suggestions.map(({ id }) => id)).toEqual([mine.id]);
      expect(body.suggestionsCount).toBe(1);
    });

    it('filters by status', async () => {
      const approved = await suggested();

      await suggested();
      await review(approved.id, { status: SuggestionStatus.Approved }).expect(
        200,
      );

      const response = await actingAs(ctx, author)
        .get(`${SUGGESTIONS_PATH}?status=${SuggestionStatus.Approved}`)
        .expect(200);

      expect(
        (response.body as SuggestionsResponseDto).suggestions.map(
          ({ id }) => id,
        ),
      ).toEqual([approved.id]);
    });
  });

  describe('GET /admin/product-suggestions', () => {
    it('lists every suggestion with its author', async () => {
      const stranger = await ctx.users.createAuthenticated();

      await suggested();
      await suggested(stranger);

      const response = await actingAs(ctx, admin)
        .get(ADMIN_SUGGESTIONS_PATH)
        .expect(200);
      const body = response.body as AdminSuggestionsResponseDto;

      expect(body.suggestionsCount).toBe(2);
      expect(body.suggestions.map(({ user }) => user.email).sort()).toEqual(
        [author.user.email, stranger.user.email].sort(),
      );
    });

    it('is closed to customers', async () => {
      await actingAs(ctx, author).get(ADMIN_SUGGESTIONS_PATH).expect(403);
    });
  });

  describe('PATCH /admin/product-suggestions/:id', () => {
    it('approves and records who reviewed it and when', async () => {
      const { id } = await suggested();

      const response = await review(id, {
        status: SuggestionStatus.Approved,
      }).expect(200);

      expect(
        (response.body as AdminSuggestionResponseDto).suggestion,
      ).toMatchObject({
        status: SuggestionStatus.Approved,
        reviewedBy: admin.user.id,
        reviewedAt: expect.any(String) as string,
        user: { id: author.user.id, fullName: 'Lanh Hung Son' },
      });
    });

    it('shows the author the note of a rejection', async () => {
      const { id } = await suggested();

      await review(id, {
        status: SuggestionStatus.Rejected,
        adminNote: NOTE,
      }).expect(200);

      const response = await actingAs(ctx, author)
        .get(SUGGESTIONS_PATH)
        .expect(200);

      expect(
        (response.body as SuggestionsResponseDto).suggestions[0],
      ).toMatchObject({ status: SuggestionStatus.Rejected, adminNote: NOTE });
    });

    it.each([
      ['en', 'A note is required to reject a suggestion'],
      ['vi', 'Cần ghi chú lý do khi từ chối gợi ý'],
    ])('needs a note to reject, in %s', async (lang, message) => {
      const { id } = await suggested();

      const response = await review(
        id,
        { status: SuggestionStatus.Rejected, adminNote: '   ' },
        `?lang=${lang}`,
      ).expect(422);

      expect(errorMessages(response.body)).toEqual([message]);
    });

    it('reviews a suggestion only once', async () => {
      const { id } = await suggested();

      await review(id, { status: SuggestionStatus.Approved }).expect(200);

      const response = await review(id, {
        status: SuggestionStatus.Rejected,
        adminNote: NOTE,
      }).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'This suggestion has already been reviewed',
      ]);
    });

    it('answers 404 for an unknown suggestion', async () => {
      await review(randomUUID(), { status: SuggestionStatus.Approved }).expect(
        404,
      );
    });

    it('refuses to set a suggestion back to PENDING', async () => {
      const { id } = await suggested();

      await review(id, { status: SuggestionStatus.Pending }).expect(400);
    });
  });
});
