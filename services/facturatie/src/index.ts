import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) =>
  c.json({ status: "ok", service: "openzorg-facturatie", timestamp: new Date().toISOString() }),
);

const port = Number(process.env.FACTURATIE_PORT) || 4003;
serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Facturatie service running on port ${info.port}`);
});

export { app };
