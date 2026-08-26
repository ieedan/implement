import { env } from "@/lib/env.dynamic.server";

export default function load() {
	return { token: env.ROTATING_TOKEN, ttl: env.SESSION_TTL };
}
