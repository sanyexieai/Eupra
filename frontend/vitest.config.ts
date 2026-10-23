import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
  esbuild: { jsx: "automatic" },
});
