import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { Network } from './network.entity';

@Entity()
export class Token {
  constructor(token: Partial<Token>) {
    Object.assign(this, token);
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column()
  address: string;

  @ManyToOne(() => Contract, (contract) => contract.tokens)
  contract: Contract;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  balanceUSD: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
