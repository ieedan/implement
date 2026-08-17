import { serve } from "@hono/node-server";
import { API_PORT, app } from "./app";

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
	console.log(`Tracker v2 API http://localhost:${info.port}`);
});
