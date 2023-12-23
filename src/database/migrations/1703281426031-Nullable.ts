import { MigrationInterface, QueryRunner } from "typeorm";

export class Nullable1703281426031 implements MigrationInterface {
    name = 'Nullable1703281426031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "balance" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "tokenHoldings" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "filePath" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "filePath" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "tokenHoldings" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "balance" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "name" SET NOT NULL`);
    }

}
