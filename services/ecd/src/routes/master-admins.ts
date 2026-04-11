import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const masterAdminRoutes = new Hono<AppEnv>();

interface MasterAdminRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

/**
 * GET /api/master/admins — List all master admins.
 */
masterAdminRoutes.get("/", async (c) => {
  const result = await pool.query<MasterAdminRow>(
    "SELECT * FROM openzorg.master_admins ORDER BY created_at ASC",
  );
  return c.json({ admins: result.rows });
});

/**
 * POST /api/master/admins — Add a master admin.
 */
masterAdminRoutes.post("/", async (c) => {
  const body = await c.req.json<{ email: string; name: string }>();

  if (!body.email || !body.name) {
    return c.json({ error: "E-mailadres en naam zijn verplicht" }, 400);
  }

  const existing = await pool.query(
    "SELECT id FROM openzorg.master_admins WHERE email = $1",
    [body.email.toLowerCase()],
  );
  if (existing.rows.length > 0) {
    return c.json({ error: "Er bestaat al een admin met dit e-mailadres" }, 409);
  }

  const result = await pool.query<MasterAdminRow>(
    `INSERT INTO openzorg.master_admins (email, name)
     VALUES ($1, $2)
     RETURNING *`,
    [body.email.toLowerCase(), body.name],
  );

  return c.json(result.rows[0], 201);
});

/**
 * DELETE /api/master/admins/:id — Remove a master admin.
 */
masterAdminRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Prevent deleting the last admin
  const countResult = await pool.query(
    "SELECT COUNT(*) as total FROM openzorg.master_admins",
  );
  const total = parseInt((countResult.rows[0] as { total: string })?.total ?? "0", 10);
  if (total <= 1) {
    return c.json({ error: "Kan de laatste master admin niet verwijderen" }, 400);
  }

  const result = await pool.query<MasterAdminRow>(
    "DELETE FROM openzorg.master_admins WHERE id = $1 RETURNING *",
    [id],
  );

  const admin = result.rows[0];
  if (!admin) {
    return c.json({ error: "Admin niet gevonden" }, 404);
  }

  return c.json({ message: "Admin verwijderd", admin });
});

