import { UserTokenField } from '../../users/dto/user-fields.decorator';

export class UserTokenDto {
  @UserTokenField()
  token: string;
}
