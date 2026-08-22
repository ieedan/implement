import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/server/index.ts"],
	outDir: "dist",
	target: "es2022",
	// Bundled rather than left external so dist/ is loadable straight from a
	// <script type="module"> with no import map: it is CommonJS-only, so a
	// browser cannot resolve it on its own.
	noExternal: ["fast-deep-equal"],
});
