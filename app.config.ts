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
	server: {
		esbuild: { options: { target: "es2024" } },
		preset: "cloudflare-pages",
		cloudflare: {
			wrangler: {
				compatibility_date: "2025-05-23",
				name: "file-host-aggregator",
				vars: {
					NODE_VERSION: 22,
				},
			},
			deployConfig: true,
		},
		compressPublicAssets: { gzip: true, brotli: true },
		compatibilityDate: { cloudflare: "latest", default: "latest" },
		routeRules: {
			"index.html": {
				headers: {
					"cache-control": "public, max-age=0, must-revalidate",
				},
			},
		},
	},
});
