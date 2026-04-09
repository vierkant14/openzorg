import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.ECD_PORT) || 4001;

serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg ECD service running on port ${info.port}`);
});
