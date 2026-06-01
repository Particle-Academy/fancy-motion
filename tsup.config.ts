import { defineConfig } from "tsup";

export default defineConfig({
  // Pure engine (`.`) + React runtime player (`./react`).
  entry: { index: "src/index.ts", react: "src/react/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "neutral",
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  treeshake: true,
});
