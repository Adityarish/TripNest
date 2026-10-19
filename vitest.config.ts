import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({ resolve: { alias: { "@": path.resolve(__dirname, ".") } }, test: { environment: "node", include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"], coverage: { reporter: ["text", "html"], include: ["lib/**/*.ts"] } } });
