import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	target: "es2022",
	// Tailwind writes dist/app.css; the default clean removes it on every JS build.
	clean: false,
	deps: {
		alwaysBundle: [
			"@packages/implement",
			"codemirror",
			"@codemirror/commands",
			"@codemirror/lang-javascript",
			"@codemirror/language",
			"@codemirror/state",
			"@codemirror/view",
			"@lezer/highlight",
			"sucrase",
		],
		onlyBundle: false,
	},
});
