import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Network } from '../../entities/network.entity';
import { NetworkType } from '../../../utils/types/enums';

@Injectable()
export class NetworkSeedService {
  constructor(
    @InjectRepository(Network)
    private networkRepository: Repository<Network>,
  ) {}

  async run() {
    const countNetworks = await this.networkRepository.count();

    if (countNetworks === 0) {
      await this.networkRepository.save(
        this.networkRepository.create({
          name: NetworkType.ETH,
        }),
      );
    }
  }
}
