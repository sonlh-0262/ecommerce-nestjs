import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsObject,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim } from '../../common/transforms/trim';
import {
  MESSAGE_CONTENT_MAX_LENGTH,
  MESSAGE_CONTENT_MIN_LENGTH,
} from '../chat.constants';

const MessageContentField = () =>
  applyDecorators(
    ApiProperty({
      minLength: MESSAGE_CONTENT_MIN_LENGTH,
      maxLength: MESSAGE_CONTENT_MAX_LENGTH,
      example: 'Đơn hàng của tôi khi nào được giao?',
    }),
    IsString(VALIDATION_MESSAGES.isString),
    Length(
      MESSAGE_CONTENT_MIN_LENGTH,
      MESSAGE_CONTENT_MAX_LENGTH,
      VALIDATION_MESSAGES.length,
    ),
    Transform(trim),
  );

export class SendMessageBodyDto {
  @MessageContentField()
  content: string;
}

export class SendMessageDto {
  @ApiProperty({ type: SendMessageBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => SendMessageBodyDto)
  message: SendMessageBodyDto;
}

export class SendMessageEventDto extends SendMessageBodyDto {
  @IsUUID('all', VALIDATION_MESSAGES.isUuid)
  conversationId: string;
}
