import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ATTACHMENTS_ATTACHABLE_INDEX,
  ATTACHMENTS_AVATAR_CONDITION,
  ATTACHMENTS_FILE_SIZE_CHECK,
  ATTACHMENTS_FILE_SIZE_EXPRESSION,
  FILE_NAME_MAX_LENGTH,
  FILE_TYPE_MAX_LENGTH,
  STORAGE_PATH_MAX_LENGTH,
  UNIQUE_ATTACHMENTS_AVATAR_INDEX,
  URL_MAX_LENGTH,
} from '../attachments.constants';
import { AttachableType } from '../enums/attachable-type.enum';

@Entity('attachments')
@Index(ATTACHMENTS_ATTACHABLE_INDEX, ['attachableType', 'attachableId'])
@Check(ATTACHMENTS_FILE_SIZE_CHECK, ATTACHMENTS_FILE_SIZE_EXPRESSION)
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'attachable_type',
    type: 'enum',
    enum: AttachableType,
    enumName: 'attachable_type',
  })
  attachableType: AttachableType;

  @Index(UNIQUE_ATTACHMENTS_AVATAR_INDEX, {
    unique: true,
    where: ATTACHMENTS_AVATAR_CONDITION,
  })
  @Column({ name: 'attachable_id', type: 'uuid' })
  attachableId: string;

  @Column({ type: 'varchar', length: URL_MAX_LENGTH })
  url: string;

  @Column({ name: 'file_name', type: 'varchar', length: FILE_NAME_MAX_LENGTH })
  fileName: string;

  @Column({ name: 'file_type', type: 'varchar', length: FILE_TYPE_MAX_LENGTH })
  fileType: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number;

  @Column({
    name: 'storage_path',
    type: 'varchar',
    length: STORAGE_PATH_MAX_LENGTH,
  })
  storagePath: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
