import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PLANNING_PORT) || 4002;

serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Planning service running on port ${info.port}`);
});
