import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
		build: { target: "es2024" },
		optimizeDeps: { esbuildOptions: { target: "es2024" } },
		esbuild: { target: "es2024" },
	},
	ssr: false,
	server: { esbuild: { options: { target: "es2024" } } },
});
