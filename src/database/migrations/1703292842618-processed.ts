import { MigrationInterface, QueryRunner } from 'typeorm';

export class Processed1703292842618 implements MigrationInterface {
  name = 'Processed1703292842618';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "isProcessed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "isProcessed"`);
  }
}
