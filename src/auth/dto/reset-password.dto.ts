import { NewPasswordField } from '../../users/dto/user-fields.decorator';
import { UserTokenDto } from './user-token.dto';

export class ResetPasswordDto extends UserTokenDto {
  @NewPasswordField()
  password: string;
}
