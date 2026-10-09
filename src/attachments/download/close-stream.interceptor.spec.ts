import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { Readable } from 'stream';

import { CloseStreamInterceptor } from './close-stream.interceptor';

describe('CloseStreamInterceptor', () => {
  const interceptor = new CloseStreamInterceptor();

  let listeners: Record<string, () => void>;
  let context: ExecutionContext;

  const closeResponse = () => listeners.close?.();

  const handlerReturning = (body: unknown): CallHandler => ({
    handle: () => of(body),
  });

  beforeEach(() => {
    listeners = {};
    const response = {
      once: jest.fn((event: string, listener: () => void) => {
        listeners[event] = listener;
      }),
    } as unknown as Response;

    context = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ExecutionContext;
  });

  it('passes the file through untouched', async () => {
    const file = new StreamableFile(Readable.from('bytes'));

    await expect(
      lastValueFrom(interceptor.intercept(context, handlerReturning(file))),
    ).resolves.toBe(file);
  });

  it('destroys the stream when the client disconnects', async () => {
    const file = new StreamableFile(Readable.from('bytes'));
    await lastValueFrom(interceptor.intercept(context, handlerReturning(file)));

    expect(file.getStream().destroyed).toBe(false);

    closeResponse();

    expect(file.getStream().destroyed).toBe(true);
  });

  it('leaves a response that is not a file alone', async () => {
    const body = { message: 'ok' };

    await expect(
      lastValueFrom(interceptor.intercept(context, handlerReturning(body))),
    ).resolves.toBe(body);
    expect(listeners.close).toBeUndefined();
  });
});
