// Deliberately typed with the wrong event: a `layout.server.ts` load takes
// `LayoutLoadEvent`, and `LoadEvent` — the page load's — carries this layout's
// own data, so annotating with it is circular. `tsc` says `TS2502` and names
// neither type; the dev server warns about it — see plugin.test.ts.
import type { LoadEvent } from "./$types";

export default function load({ url }: LoadEvent) {
	return { path: url.pathname };
}
