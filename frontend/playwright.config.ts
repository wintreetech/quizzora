import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(24).toString("base64url");
export default defineConfig({
  globalTeardown: "./tests/teardown.ts",
  testDir: "./tests",
  testMatch: "*.spec.ts",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:5174",
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: [
    {
      command: "npm run test:browser-server",
      cwd: "../backend",
      url: "http://127.0.0.1:4100/api/health",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        APP_ORIGIN: "http://localhost:5174",
        E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      },
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://localhost:5174",
      timeout: 30000,
      reuseExistingServer: false,
      env: {
        VITE_API_URL: "http://localhost:4100",
        QUIZORA_E2E: "1",
        E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      },
    },
  ],
});
