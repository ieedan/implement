import { defineConfig } from "vite";

export default defineConfig({
	build: { target: "es2022" },
	server: { port: 3010, strictPort: true },
	preview: { port: 4010, strictPort: true },
});
