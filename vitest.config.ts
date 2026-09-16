import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "server",
          environment: "node",
          include: ["tests/server/**/*.test.ts", "tests/unit/**/*.test.ts"],
          setupFiles: ["tests/server/helpers/env.ts"],
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}", "tests/client/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "shared/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["server/index.ts", "server/mocks/**", "**/*.d.ts"],
    },
  },
});
