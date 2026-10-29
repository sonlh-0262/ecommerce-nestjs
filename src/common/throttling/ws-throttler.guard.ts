import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthenticatedSocket } from '../sockets/authenticated-socket';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    const socket = context.switchToWs().getClient<AuthenticatedSocket>();

    return { req: { ...socket.data }, res: {} };
  }
}
