import { Pre, type Child } from "@implementjs/core";
// `?raw` asks for the file's text, not its bindings — a deliberate act, and how this repo's
// docs site renders lesson `*.server.ts` sources. The guard leaves it alone.
// @ts-expect-error -- the fixture has no vite/client types
import source from "../../lib/secrets.server.ts?raw";

export default function Page(): Child {
	return Pre(source);
}
