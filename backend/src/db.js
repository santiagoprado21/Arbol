import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const TZ = 'America/Bogota';

const DATE_OID = 1082;
const keepDateAsText = (v) => v;

let impl;

async function initPostgres(url) {
  pg.types.setTypeParser(DATE_OID, keepDateAsText);
  const useSsl = process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === 'true'
    : url.includes('.render.com');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  pool.on('connect', (client) => client.query(`SET TIME ZONE '${TZ}'`));

  impl = {
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function initPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || path.resolve('.pglite');
  const db = new PGlite(dir, { parsers: { [DATE_OID]: keepDateAsText } });
  await db.exec(`SET TIME ZONE '${TZ}'`);

  impl = {
    query: (text, params) => db.query(text, params),
    exec: (sql) => db.exec(sql),
    tx: (fn) => db.transaction((t) => fn({ query: (q, p) => t.query(q, p) })),
  };
  console.log(`[db] Usando PGlite local en ${dir}`);
}

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) await initPostgres(url);
  else await initPglite();

  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  await impl.exec(fs.readFileSync(schemaPath, 'utf8'));
}

export const query = (text, params = []) => impl.query(text, params);
export const tx = (fn) => impl.tx(fn);

export async function one(text, params = []) {
  const { rows } = await query(text, params);
  return rows[0];
}
