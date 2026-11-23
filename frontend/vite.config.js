import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(process.env.QUIZORA_E2E === "1"
      ? [
          {
            name: "isolated-test-shutdown",
            configureServer(server) {
              server.middlewares.use("/__e2e/shutdown", (req, res, next) => {
                if (
                  req.method !== "POST" ||
                  req.headers["x-test-key"] !== process.env.E2E_ADMIN_PASSWORD
                )
                  return next();
                res.end("ok");
                setTimeout(async () => {
                  await server.close();
                  process.exit(0);
                }, 100);
              });
            },
          },
        ]
      : []),
  ],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
});
