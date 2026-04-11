import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.WORKFLOW_PORT) || 4003;

serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`OpenZorg Workflow Bridge service running on port ${info.port}`);
});
