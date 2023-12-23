import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { NetworkSeedService } from './network/network-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule, new FastifyAdapter());

  await app.get(NetworkSeedService).run();

  await app.close();
};

runSeed();
