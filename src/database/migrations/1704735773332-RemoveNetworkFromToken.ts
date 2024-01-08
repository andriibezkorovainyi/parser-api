import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveNetworkFromToken1704735773332 implements MigrationInterface {
    name = 'RemoveNetworkFromToken1704735773332'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_9fc766f483e0d16abeb31f11f0d"`);
        await queryRunner.query(`ALTER TABLE "token" DROP COLUMN "networkId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "token" ADD "networkId" integer`);
        await queryRunner.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_9fc766f483e0d16abeb31f11f0d" FOREIGN KEY ("networkId") REFERENCES "network"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
