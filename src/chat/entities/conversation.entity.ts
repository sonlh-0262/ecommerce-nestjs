import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import {
  CONVERSATIONS_LAST_MESSAGE_INDEX,
  CONVERSATIONS_USER_FK,
  UNIQUE_CONVERSATIONS_USER_INDEX,
} from '../chat.constants';
import { Message } from './message.entity';

@Entity('conversations')
@Index(CONVERSATIONS_LAST_MESSAGE_INDEX, ['lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index(UNIQUE_CONVERSATIONS_USER_INDEX, { unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.conversation, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: CONVERSATIONS_USER_FK,
  })
  user: User;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Message[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
