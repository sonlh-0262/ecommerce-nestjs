import { Type } from '@nestjs/common';

export interface TestAppOptions {
  /**
   * Build the OpenAPI document. Off by default - only the spec that asserts
   * the document pays for it.
   */
  swagger?: boolean;
  module?: Type<unknown>;
}
