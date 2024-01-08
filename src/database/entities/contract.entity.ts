import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Network } from './network.entity';
import { Token } from './token.entity';
import { ITokenBalance } from '../../utils/types/interfaces';

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

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  tokenBalanceUSD: number;

  @OneToMany(() => Token, (token) => token.contract)
  tokens: Token[];

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  isVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
