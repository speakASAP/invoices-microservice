import { Client } from 'pg';

type DatabaseBootstrapEnv = NodeJS.ProcessEnv;

export async function ensureDatabaseExistsFromEnv(env: DatabaseBootstrapEnv = process.env): Promise<void> {
  if (env.DB_AUTO_CREATE !== 'true') {
    return;
  }

  const database = validateDatabaseName(env.DB_NAME || '');
  const client = new Client({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432', 10),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_ADMIN_DATABASE || 'postgres',
  });

  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1', [database]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
    }
  } finally {
    await client.end();
  }
}

export function validateDatabaseName(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
    throw new Error('DB_NAME must contain only letters, numbers, and underscores when DB_AUTO_CREATE=true');
  }
  return normalized;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
