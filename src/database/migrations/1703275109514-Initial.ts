import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1703275109514 implements MigrationInterface {
  name = 'Initial1703275109514';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."network_name_enum" AS ENUM('ETH', 'MATIC')`,
    );

    await queryRunner.query(
      `CREATE TABLE "network" ("id" SERIAL NOT NULL, "name" "public"."network_name_enum" NOT NULL, CONSTRAINT "PK_8f8264c2d37cbbd8282ee9a3c97" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "contract" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "address" character varying NOT NULL, "balance" integer NOT NULL, "blockNumber" integer NOT NULL, "tokenHoldings" json NOT NULL, "filePath" character varying NOT NULL, "blockTimestamp" TIMESTAMP NOT NULL, "isVerified" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "networkId" integer, CONSTRAINT "PK_17c3a89f58a2997276084e706e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_233938e2df076b8c554896ea0a" ON "contract" ("blockTimestamp") `,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD CONSTRAINT "FK_b8ee4adea6e3668809e6757dc93" FOREIGN KEY ("networkId") REFERENCES "network"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract" DROP CONSTRAINT "FK_b8ee4adea6e3668809e6757dc93"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_233938e2df076b8c554896ea0a"`,
    );
    await queryRunner.query(`DROP TABLE "contract"`);
    await queryRunner.query(`DROP TABLE "network"`);
    await queryRunner.query(`DROP TYPE "public"."network_name_enum"`);
  }
}
