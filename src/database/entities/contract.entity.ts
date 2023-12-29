import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Network } from './network.entity';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  address: string;

  @Column()
  blockNumber: number;

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ type: 'timestamp' })
  @Index()
  blockTimestamp: Date;

  @ManyToOne(() => Network, (network) => network.contracts)
  network: Network;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  balance: number;

  @Column('json', { nullable: true })
  tokenHoldings: Array<Record<string, any>>;

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  isVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
