import { EmailField } from '../../users/dto/user-fields.decorator';

export class AccountEmailDto {
  @EmailField()
  email: string;
}
