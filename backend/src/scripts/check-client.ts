import "../config.js";
import { readdir, readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const values = [process.env.WORKING_KEY, process.env.TW_AUTH_TOKEN, process.env.SMTP_PASSWORD, process.env.DATABASE_URL].filter((value): value is string => !!value && value.length >= 8);
try {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL || "").password);
  if (password.length >= 8) values.push(password);
} catch { /* No configured database URI to inspect. */ }
let scanned = 0;
const problems: string[] = [];
async function inspect(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if ([".ts", ".tsx", ".js", ".css", ".html"].includes(extname(path))) {
      const content = await readFile(path, "utf8");
      scanned++;
      if (values.some((value) => content.includes(value) || content.includes(JSON.stringify(value).slice(1, -1)))) problems.push(`Configured backend credential found in ${path}`);
      if (/Demo Payment|Try demo checkout|Simulate successful payment/.test(content)) problems.push(`Removed payment simulation copy found in ${path}`);
    }
  }
}
await inspect(resolve("../frontend/src"));
await inspect(resolve("../frontend/dist"));
if (problems.length) throw new Error(problems.join("\n"));
console.info(`${scanned} client source/build artifacts checked; no configured backend credential values or removed payment-simulation labels found. ${values.length ? "Configured secret values were checked without printing them." : "No secret values were configured for comparison."}`);
