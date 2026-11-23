import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";

function inspect(overrides: Record<string, string>) {
  return new Promise<{ code: number | null; output: string; error: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", "const {config}=await import('./src/config.ts');console.log(JSON.stringify({origin:config.origin,apiUrl:config.apiUrl,port:config.port,sameSite:config.sameSite}))"], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "mongodb://database.invalid/quizora", APP_ORIGIN: "https://quizora-web.onrender.com/", RENDER_EXTERNAL_URL: "https://quizora-api.onrender.com/", API_PUBLIC_URL: "", PORT: "10000", COOKIE_SAME_SITE: "none", BILLING_ENABLED: "false", ...overrides },
      timeout: 10000,
    });
    let output = "", error = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { error += data; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output, error }));
  });
}
describe("Render production environment", () => {
  it("uses Render's public HTTPS URL and assigned port with secure cross-site session settings", async () => {
    const result = await inspect({});
    expect(result.code, result.error).toBe(0);
    expect(JSON.parse(result.output)).toEqual({ origin: "https://quizora-web.onrender.com", apiUrl: "https://quizora-api.onrender.com", port: 10000, sameSite: "none" });
  });
  it("prefers an explicit API custom domain and normalizes pasted whitespace/slashes", async () => {
    const result = await inspect({ APP_ORIGIN: " https://play.example.com/// ", API_PUBLIC_URL: " https://api.example.com/// ", COOKIE_SAME_SITE: "lax" });
    expect(result.code, result.error).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({ origin: "https://play.example.com", apiUrl: "https://api.example.com", sameSite: "lax" });
  });
  it("rejects production without a database or HTTPS frontend", async () => {
    expect((await inspect({ DATABASE_URL: "" })).code).toBe(1);
    expect((await inspect({ APP_ORIGIN: "http://quizora-web.onrender.com" })).code).toBe(1);
  });
  it("rejects cross-site cookies on an HTTP development deployment", async () => {
    expect((await inspect({ NODE_ENV: "development" })).code).toBe(1);
  });
});
