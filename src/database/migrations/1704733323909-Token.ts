import { MigrationInterface, QueryRunner } from "typeorm";

export class Token1704733323909 implements MigrationInterface {
    name = 'Token1704733323909'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "token" ("id" SERIAL NOT NULL, "name" character varying, "address" character varying NOT NULL, "balance" numeric(20,8) NOT NULL, "balanceUSD" numeric(20,8), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "contractId" integer, "networkId" integer, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "contract" ADD "tokenBalanceUSD" numeric(20,8)`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "balance" TYPE numeric(20,8)`);
        await queryRunner.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_e1e0bb89232fd29baf8e3459c0d" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_9fc766f483e0d16abeb31f11f0d" FOREIGN KEY ("networkId") REFERENCES "network"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_9fc766f483e0d16abeb31f11f0d"`);
        await queryRunner.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_e1e0bb89232fd29baf8e3459c0d"`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "balance" TYPE numeric(18,8)`);
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "tokenBalanceUSD"`);
        await queryRunner.query(`DROP TABLE "token"`);
    }

}
