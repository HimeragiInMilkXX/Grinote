import { defineConfig } from "vitest/config";
import path from "node:path";

/** Model evals against a local Ollama server: `npm run eval:tree` (slow; not part of `npm test`). */
export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve( __dirname, "src" ),
            "server-only": path.resolve( __dirname, "scripts/stubs/server-only.ts" ),
        },
    },
    test: {
        environment: "node",
        include: [ "scripts/**/*.eval.ts" ],
        testTimeout: 30 * 60 * 1000,
        hookTimeout: 60 * 1000,
    },
});
