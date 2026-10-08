import { randomUUID } from 'crypto';
import { access } from 'fs/promises';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';

import { ATTACHMENT_CACHE_CONTROL } from '../src/attachments/attachments.constants';
import { AttachmentsService } from '../src/attachments/attachments.service';
import { Attachment } from '../src/attachments/entities/attachment.entity';
import { AttachableType } from '../src/attachments/enums/attachable-type.enum';
import { LocalStorageService } from '../src/attachments/storage/local-storage.service';
import { bearer, errorMessages } from './support/http';
import { PNG_IMAGE } from './support/images';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { ATTACHMENTS_PATH } from './support/test.constants';

describe('Attachments (e2e)', () => {
  let ctx: TestContext;
  let attachments: AttachmentsService;
  let storage: LocalStorageService;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    attachments = ctx.app.get(AttachmentsService);
    storage = ctx.app.get(LocalStorageService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    token = (await ctx.users.createAuthenticated()).session.token;
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const fileExists = (storagePath: string): Promise<boolean> =>
    access(storage.resolve(storagePath)).then(
      () => true,
      () => false,
    );

  const attach = (ownerId: string = randomUUID()) =>
    ctx.dataSource.transaction((manager) =>
      attachments.attach(
        manager,
        attachments.validate({
          originalname: 'ảnh đại diện.png',
          buffer: PNG_IMAGE,
        }),
        { type: AttachableType.User, id: ownerId },
      ),
    );

  const download = (id: string) =>
    request(ctx.server())
      .get(`${ATTACHMENTS_PATH}/${id}`)
      .set(...bearer(token));

  describe('GET /attachments/:id', () => {
    it('streams the file to a signed-in account', async () => {
      const attachment = await attach();

      const response = await download(attachment.id)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(Buffer.compare(response.body as Buffer, PNG_IMAGE)).toBe(0);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-length']).toBe(String(PNG_IMAGE.length));
      expect(response.headers['cache-control']).toBe(ATTACHMENT_CACHE_CONTROL);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('keeps a non-ASCII file name in the download header', async () => {
      const attachment = await attach();

      const response = await download(attachment.id).expect(200);

      expect(response.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent('ảnh đại diện.png')}`,
      );
    });

    it('serves the file at the url stored on the row', async () => {
      const attachment = await attach();

      expect(attachment.url).toBe(`${ATTACHMENTS_PATH}/${attachment.id}`);
      await request(ctx.server())
        .get(attachment.url)
        .set(...bearer(token))
        .expect(200);
    });

    it('refuses an anonymous caller with 401', async () => {
      const attachment = await attach();

      await request(ctx.server())
        .get(`${ATTACHMENTS_PATH}/${attachment.id}`)
        .expect(401);
    });

    it('refuses a bad token with 401', async () => {
      const attachment = await attach();

      await request(ctx.server())
        .get(`${ATTACHMENTS_PATH}/${attachment.id}`)
        .set(...bearer('not-a-token'))
        .expect(401);
    });

    it('answers an unknown id with a translated 404', async () => {
      const response = await download(randomUUID())
        .query({ lang: 'vi' })
        .expect(404);

      expect(errorMessages(response.body)).toEqual(['Không tìm thấy tệp']);
    });

    it('answers 404 when the row outlived its file', async () => {
      const attachment = await attach();
      await storage.remove(attachment.storagePath);

      await download(attachment.id).expect(404);
    });

    it('rejects an id that is not a uuid with 400', async () => {
      const response = await download('not-a-uuid').expect(400);

      expect(errorMessages(response.body)).toEqual(['id must be a UUID']);
    });
  });

  describe('AttachmentsService inside a transaction', () => {
    it('writes the file under yyyy/MM with a uuid name', async () => {
      const attachment = await attach();

      expect(attachment.storagePath).toMatch(
        new RegExp(`^\\d{4}/\\d{2}/${attachment.id}\\.png$`),
      );
      await expect(fileExists(attachment.storagePath)).resolves.toBe(true);
    });

    it('removes the written file when the transaction rolls back', async () => {
      let storagePath = '';

      await expect(
        ctx.dataSource.transaction(async (manager) => {
          const attachment = await attachments.attach(
            manager,
            attachments.validate({ originalname: 'a.png', buffer: PNG_IMAGE }),
            { type: AttachableType.User, id: randomUUID() },
          );
          storagePath = attachment.storagePath;

          throw new Error('the rest of the feature failed');
        }),
      ).rejects.toThrow('the rest of the feature failed');

      await expect(fileExists(storagePath)).resolves.toBe(false);
      await expect(
        ctx.dataSource.getRepository(Attachment).count(),
      ).resolves.toBe(0);
    });

    it('deletes the file on detach only once the transaction commits', async () => {
      const attachment = await attach();

      await ctx.dataSource.transaction(async (manager) => {
        await attachments.detach(manager, attachment.id);

        await expect(fileExists(attachment.storagePath)).resolves.toBe(true);
      });

      await expect(fileExists(attachment.storagePath)).resolves.toBe(false);
    });

    it('keeps the file when the detach is rolled back', async () => {
      const attachment = await attach();

      await expect(
        ctx.dataSource.transaction(async (manager) => {
          await attachments.detach(manager, attachment.id);
          throw new Error('rolled back');
        }),
      ).rejects.toThrow('rolled back');

      await expect(fileExists(attachment.storagePath)).resolves.toBe(true);
      await download(attachment.id).expect(200);
    });

    it('keeps the file when a detach inside a savepoint is rolled back', async () => {
      const attachment = await attach();

      await ctx.dataSource.transaction(async (manager) => {
        await manager
          .transaction(async (nested) => {
            await attachments.detach(nested, attachment.id);
            throw new Error('the nested step failed');
          })
          .catch(() => undefined);
      });

      await expect(fileExists(attachment.storagePath)).resolves.toBe(true);
      await download(attachment.id).expect(200);
    });

    it('allows one avatar per account, and cleans up the refused file', async () => {
      const ownerId = randomUUID();
      const first = await attach(ownerId);

      const refused = await attach(ownerId).then(
        () => null,
        (error: unknown) => error,
      );

      expect(refused).toBeInstanceOf(QueryFailedError);
      expect(
        (refused as QueryFailedError<Error & { constraint?: string }>)
          .driverError.constraint,
      ).toBe('UQ_attachments_avatar');
      await expect(ctx.storedFiles()).resolves.toEqual([first.storagePath]);
    });

    it('loads the attachments of several owners in one call', async () => {
      const first = randomUUID();
      const second = randomUUID();
      await attach(first);
      await attach(second);

      const byOwner = await attachments.findForOwner(AttachableType.User, [
        first,
        second,
        randomUUID(),
      ]);

      expect(byOwner.get(first)).toHaveLength(1);
      expect(byOwner.get(second)).toHaveLength(1);
      expect(byOwner.size).toBe(2);
    });
  });
});
