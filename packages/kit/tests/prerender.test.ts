import { describe, expect, it } from "vitest";
import { OPENAPI_FILE } from "../src/openapi.ts";
import { prerenderPolicy, type PrerenderDefault } from "../src/prerender.ts";
import type { RouteTree } from "../src/scan.ts";

/** An app with one endpoint and nothing else the policy has to walk. */
const tree: RouteTree = {
	root: {
		dir: "",
		segment: null,
		params: [],
		page: null,
		pageResetTo: null,
		layout: null,
		layoutResetTo: null,
		pageServer: null,
		layoutServer: null,
		endpoint: null,
		endpointSocket: false,
		error: null,
		extensions: [],
		children: [
			{
				dir: "api",
				segment: { kind: "static", value: "api" },
				params: [],
				page: null,
				pageResetTo: null,
				layout: null,
				layoutResetTo: null,
				pageServer: null,
				layoutServer: null,
				endpoint: "api/server.ts",
				endpointSocket: false,
				error: null,
				extensions: [],
				children: [],
			},
		],
	},
	error: null,
	warnings: [],
	matchers: [],
};

/**
 * A policy over a module runner that records what it was asked for — and
 * refuses it the way Vite's does for a module the app never wrote.
 */
function policyOver(fallback: PrerenderDefault, asked: string[], module: Record<string, unknown>) {
	return prerenderPolicy({
		tree,
		routesBase: "/src/routes",
		fallback,
		load: async (id) => {
			asked.push(id);
			if (!(id in module)) throw new Error(`Failed to load url ${id}. Does the file exist?`);
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fixture's values are the module namespaces this stands in for.
			return module[id] as Record<string, unknown>;
		},
	});
}

describe("prerenderPolicy", () => {
	it("reads an endpoint's prerender flag off its own file", async () => {
		const asked: string[] = [];
		const policy = policyOver("auto", asked, { "/src/routes/api/server.ts": { prerender: true } });
		expect(await policy.endpoint({ file: "api/server.ts" })).toBe(true);
		expect(asked).toEqual(["/src/routes/api/server.ts"]);
	});

	it("never asks the module runner for the OpenAPI route", async () => {
		const asked: string[] = [];
		// `api.openapi.path` mounts a route the app never wrote a file for, and
		// asking for one made every build log an error that reads like a broken import
		expect(await policyOver(true, asked, {}).endpoint({ file: OPENAPI_FILE })).toBe(true);
		// with a server behind it the document is served live rather than frozen
		expect(await policyOver("auto", asked, {}).endpoint({ file: OPENAPI_FILE })).toBe(false);
		expect(asked).toEqual([]);
	});
});
