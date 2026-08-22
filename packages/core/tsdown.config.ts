import { defineConfig } from "tsdown";

export default defineConfig({
	// every subpath in `exports` needs its own entry — tsdown writes each one to
	// the path under `dist` that `publishConfig.exports` points at.
	entry: ["src/index.ts", "src/hydrate.ts", "src/components/elements.ts", "src/server/index.ts"],
	outDir: "dist",
	target: "es2022",
});
