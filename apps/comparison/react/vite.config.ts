import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: { target: "es2022" },
	server: { port: 3011, strictPort: true },
	preview: { port: 4011, strictPort: true },
});
