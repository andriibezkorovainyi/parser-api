import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Contract } from './contract.entity';
import { NetworkType } from '../../utils/types/enums';

@Entity()
export class Network {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NetworkType })
  name: NetworkType;

  @OneToMany(() => Contract, (contract) => contract.network)
  contracts: Contract[];
}
