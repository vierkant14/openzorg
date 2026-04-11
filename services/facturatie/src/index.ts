import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { declaratieRoutes } from "./routes/declaraties.js";
import { prestatieRoutes } from "./routes/prestaties.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) =>
  c.json({ status: "ok", service: "openzorg-facturatie", timestamp: new Date().toISOString() }),
);

// Prestaties (care activities)
app.route("/api/prestaties", prestatieRoutes);

// Declaraties (billing declarations)
app.route("/api/declaraties", declaratieRoutes);

const port = Number(process.env["FACTURATIE_PORT"]) || 4004;
serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Facturatie service running on port ${info.port}`);
});

export { app };
