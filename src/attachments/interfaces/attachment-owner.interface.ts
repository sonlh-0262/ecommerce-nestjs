import { AttachableType } from '../enums/attachable-type.enum';

export interface AttachmentOwner {
  type: AttachableType;
  id: string;
}
