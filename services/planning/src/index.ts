import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) =>
  c.json({ status: "ok", service: "openzorg-planning", timestamp: new Date().toISOString() }),
);

const port = Number(process.env.PLANNING_PORT) || 4002;
serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Planning service running on port ${info.port}`);
});

export { app };
