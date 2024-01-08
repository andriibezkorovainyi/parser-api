import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTokenHoldings1704741785249 implements MigrationInterface {
    name = 'DropTokenHoldings1704741785249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "tokenHoldings"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" ADD "tokenHoldings" json`);
    }

}
