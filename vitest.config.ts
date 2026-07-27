import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    /**
     * `.tsx` is included, and jsdom is a devDependency, because neither was
     * true before: the package's only suite tested `interpolate` and there was
     * no way to render either React component. That is how a timeline shipped
     * with keyframe buttons containing no content at all — nothing here could
     * look at the output.
     *
     * Per-file `@vitest-environment jsdom` keeps the logic suites on node.
     */
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
