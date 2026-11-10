import { defineConfig } from "@playwright/test";

export default defineConfig({ testDir: ".", timeout: 90_000, workers: 1, use: { trace: "off" } });
