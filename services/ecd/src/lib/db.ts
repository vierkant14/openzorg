import pg from "pg";

const { Pool } = pg;

/**
 * PostgreSQL connection pool for tenant management.
 * Connects to the openzorg schema in the main database.
 */
export const pool = new Pool({
  host: process.env["POSTGRES_HOST"] || "localhost",
  port: parseInt(process.env["POSTGRES_PORT"] || "5432", 10),
  database: process.env["POSTGRES_DB"] || "openzorg",
  user: process.env["POSTGRES_USER"] || "openzorg",
  password: process.env["POSTGRES_PASSWORD"] || "openzorg_dev_password",
  max: 5,
});
