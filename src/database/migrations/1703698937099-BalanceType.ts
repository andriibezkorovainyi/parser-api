import { MigrationInterface, QueryRunner } from "typeorm";

export class BalanceType1703698937099 implements MigrationInterface {
    name = 'BalanceType1703698937099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "balance"`);
        await queryRunner.query(`ALTER TABLE "contract" ADD "balance" numeric(18,8)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "balance"`);
        await queryRunner.query(`ALTER TABLE "contract" ADD "balance" integer`);
    }

}
