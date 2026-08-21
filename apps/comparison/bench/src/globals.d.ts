/** The surface each app installs for the driver. Mirrors `src/bench.ts` in the apps. */
import type { Probe } from "./steps.ts";
import type { DomCounts } from "./dom-ops.ts";

declare global {
	interface Window {
		__bench: {
			names: string[];
			run(name: string): Promise<Probe & { ms: number; settleHops: number }>;
		};
		/** Installed by `dom-ops.ts` only. */
		__domCounts: () => DomCounts;
		__resetDomCounts: () => void;
	}
}
