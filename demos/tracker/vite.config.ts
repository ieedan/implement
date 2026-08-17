import { implement } from "@packages/implement/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [implement(), tailwindcss()],
	server: { port: 3003, strictPort: true },
});
