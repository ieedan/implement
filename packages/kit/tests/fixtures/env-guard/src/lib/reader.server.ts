import { secret } from "./secrets.server";

/** Server-to-server: one server file importing another is always legal. */
export const token = secret.token;
