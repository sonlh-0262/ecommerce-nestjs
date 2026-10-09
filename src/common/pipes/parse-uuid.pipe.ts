import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  constructor(private readonly i18n: I18nService) {}

  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isUUID(value)) {
      throw new BadRequestException(
        this.i18n.t('validation.IS_UUID', {
          args: { property: metadata.data ?? 'id' },
        }),
      );
    }

    return value;
  }
}
