import { env } from "@/lib/env.server";
import type { Handle } from "@implementjs/kit/server";

/** Server env reaches hooks the same way it reaches loads — one ordinary import. */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.database = env.DATABASE_URL;
	return await resolve(event);
};
