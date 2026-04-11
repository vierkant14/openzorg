import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env["POSTGRES_HOST"] || "localhost",
  port: parseInt(process.env["POSTGRES_PORT"] || "5432", 10),
  database: process.env["POSTGRES_DB"] || "openzorg",
  user: process.env["POSTGRES_USER"] || "openzorg",
  password: process.env["POSTGRES_PASSWORD"] || "openzorg_dev_password",
  max: 5,
});

export async function getTenantUuid(tenantId: string): Promise<string | null> {
  const res = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 OR slug = $1 LIMIT 1",
    [tenantId],
  );
  return (res.rows[0]?.id as string) ?? null;
}
