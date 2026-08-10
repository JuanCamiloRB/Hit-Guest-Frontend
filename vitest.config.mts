import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import { fileURLToPath } from "node:url"

// Vitest config for HitGuest Frontend (Next.js App Router, no backend of its
// own). `.mts` so Vite loads it as ESM directly — the repo has no
// "type": "module" in package.json.
//
// `vite-tsconfig-paths` reads the "@" alias straight from tsconfig.json
// instead of duplicating it here, so the two can't drift.
//
// Scope: unit tests for pure logic modules and services under each feature's
// lib and services folders, plus component tests with React Testing
// Library. No E2E here — that would be a separate Playwright setup, not
// installed.
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    resolve: {
        alias: {
            // `server-only` lo inyecta Next en el build y no existe en
            // node_modules: sin este alias, cualquier test que importe un módulo
            // de servidor falla al resolverlo.
            "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["node_modules", ".next"],
    },
})
