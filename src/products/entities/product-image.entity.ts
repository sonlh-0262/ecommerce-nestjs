import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Attachment } from '../../attachments/entities/attachment.entity';
import {
  PRODUCT_IMAGES_ATTACHMENT_FK,
  PRODUCT_IMAGES_POSITION_CHECK,
  PRODUCT_IMAGES_POSITION_EXPRESSION,
  PRODUCT_IMAGES_PRODUCT_FK,
  PRODUCT_IMAGES_THUMBNAIL_CONDITION,
  UNIQUE_PRODUCT_IMAGES_ATTACHMENT_INDEX,
  UNIQUE_PRODUCT_IMAGES_POSITION_INDEX,
  UNIQUE_PRODUCT_IMAGES_THUMBNAIL_INDEX,
} from '../products.constants';
import { Product } from './product.entity';

@Entity('product_images')
@Index(UNIQUE_PRODUCT_IMAGES_POSITION_INDEX, ['productId', 'position'], {
  unique: true,
})
@Index(UNIQUE_PRODUCT_IMAGES_THUMBNAIL_INDEX, ['productId'], {
  unique: true,
  where: PRODUCT_IMAGES_THUMBNAIL_CONDITION,
})
@Check(PRODUCT_IMAGES_POSITION_CHECK, PRODUCT_IMAGES_POSITION_EXPRESSION)
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: PRODUCT_IMAGES_PRODUCT_FK,
  })
  product: Product;

  @Index(UNIQUE_PRODUCT_IMAGES_ATTACHMENT_INDEX, { unique: true })
  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId: string;

  @ManyToOne(() => Attachment, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'attachment_id',
    foreignKeyConstraintName: PRODUCT_IMAGES_ATTACHMENT_FK,
  })
  attachment: Attachment;

  @Column({ name: 'is_thumbnail', type: 'boolean', default: false })
  isThumbnail: boolean;

  @Column({ type: 'smallint', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
