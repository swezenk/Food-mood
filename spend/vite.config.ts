import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Strict CSP for production builds only (dev needs inline scripts for HMR).
// The app is fully client-side, so it never needs to talk to another origin.
const csp: Plugin = {
  name: "csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />`,
    ),
};

export default defineConfig({
  plugins: [csp],
  test: { include: ["src/**/*.test.ts"] },
});
