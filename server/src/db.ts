import { Pool } from 'pg';

export const db = new Pool({
  host:     process.env.PG_HOST     ?? 'localhost',
  port:     parseInt(process.env.PG_PORT ?? '5432'),
  database: process.env.PG_DB       ?? 'eve_sde',
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});
