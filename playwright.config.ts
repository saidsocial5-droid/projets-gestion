import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000", trace: "off" },
  workers: 1,
});
