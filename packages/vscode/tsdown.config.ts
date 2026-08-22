import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/extension.ts"],
	outDir: "dist",
	target: "es2022",
	platform: "node",
	// The extension host loads this with `require`, so the bundle is CommonJS —
	// and the package is deliberately not `"type": "module"` for the same
	// reason. `.js` rather than tsdown's default `.cjs`, since some hosts only
	// look for a `.js` entry point.
	format: ["cjs"],
	outExtensions: () => ({ js: ".js" }),
	dts: false,
	deps: {
		// Provided by the extension host, never bundled.
		neverBundle: ["vscode"],
		// vsce ships `dist` alone, so nothing may be left to resolve at runtime.
		alwaysBundle: [/.*/],
	},
});
