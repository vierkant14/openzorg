import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "openzorg-workflow-bridge",
    timestamp: new Date().toISOString(),
    note: "Flowable integration komt in sprint 3",
  }),
);

const port = Number(process.env.WORKFLOW_BRIDGE_PORT) || 4004;
serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Workflow Bridge service running on port ${info.port}`);
});

export { app };
