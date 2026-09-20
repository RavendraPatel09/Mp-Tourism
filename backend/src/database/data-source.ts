import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from 'src/entities';

loadEnv();

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: int(process.env.DATABASE_PORT, 5432),
  username: process.env.DATABASE_USER ?? 'bharat',
  password: process.env.DATABASE_PASSWORD ?? 'bharat',
  database: process.env.DATABASE_NAME ?? 'bharat_trails',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  /**
   * Never true, in any environment. The schema is defined by the SQL in
   * `migrations/` — including PostGIS columns, partial indexes and triggers that
   * TypeORM cannot express — and synchronize would quietly undo them.
   */
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true' ? ['query', 'error'] : ['error'],
};

/** Used by the TypeORM CLI (`npm run migration:run`). */
export default new DataSource(dataSourceOptions);
