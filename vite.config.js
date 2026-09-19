import { publicFirebaseConfig } from "./src/services/public-config.js";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const browserMode =
    env.VITE_USE_EMULATORS !== "true" &&
    (env.VITE_BACKEND || "browser") === "browser";
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
              backend: browserMode ? "browser" : "firebase-functions",
              projectId:
                env.VITE_FIREBASE_PROJECT_ID ||
                (browserMode ? publicFirebaseConfig.projectId : null),
              region: env.VITE_FUNCTIONS_REGION || null,
              configured:
                browserMode ||
                Boolean(
                  env.VITE_FIREBASE_API_KEY &&
                    env.VITE_FIREBASE_APP_ID &&
                    (env.VITE_BACKEND === "browser" ||
                      env.VITE_APPCHECK_SITE_KEY),
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
