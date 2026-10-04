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

import { User } from '../../users/entities/user.entity';
import {
  MESSAGES_CONTENT_CHECK,
  MESSAGES_CONVERSATION_FK,
  MESSAGES_LISTING_INDEX,
  MESSAGES_SENDER_FK,
  MESSAGES_UNREAD_CONDITION,
  MESSAGES_UNREAD_INDEX,
  MESSAGE_CONTENT_MAX_LENGTH,
} from '../chat.constants';
import { Conversation } from './conversation.entity';

@Entity('messages')
@Index(MESSAGES_LISTING_INDEX, ['conversationId', 'createdAt', 'id'])
@Index(MESSAGES_UNREAD_INDEX, ['conversationId'], {
  where: MESSAGES_UNREAD_CONDITION,
})
@Check(MESSAGES_CONTENT_CHECK, 'char_length(content) BETWEEN 1 AND 2000')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
    foreignKeyConstraintName: MESSAGES_CONVERSATION_FK,
  })
  conversation: Conversation;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, (user) => user.messages, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'sender_id',
    foreignKeyConstraintName: MESSAGES_SENDER_FK,
  })
  sender: User;

  @Column({ type: 'varchar', length: MESSAGE_CONTENT_MAX_LENGTH })
  content: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
