import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      tailwind(),
      {
        name: "deployment-metadata",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "deployment-metadata.json",
            source: JSON.stringify({
              emulator: env.VITE_USE_EMULATORS === "true",
              projectId: env.VITE_FIREBASE_PROJECT_ID || null,
              region: env.VITE_FUNCTIONS_REGION || null,
              configured: Boolean(
                env.VITE_FIREBASE_API_KEY &&
                  env.VITE_FIREBASE_APP_ID &&
                  env.VITE_APPCHECK_SITE_KEY,
              ),
            }),
          });
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: [
              "firebase/app",
              "firebase/auth",
              "firebase/functions",
              "firebase/app-check",
            ],
          },
        },
      },
    },
    test: { include: ["tests/*.test.{js,jsx}"], environment: "node" },
  };
});
