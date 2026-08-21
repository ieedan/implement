import { env } from "@/lib/env.server";
import { env as publicEnv } from "@/lib/env.public";

export default function load() {
	return { database: env.DATABASE_URL, site: publicEnv.PUBLIC_SITE_URL };
}
