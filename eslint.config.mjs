// ESLint flat config for Veronum-site.
//
// The single most important rule here is `react-hooks/rules-of-hooks`
// (set to "error"). It catches the EXACT bug we just hit — calling a
// hook (useMemo / useEffect / etc.) after an early return, which causes
// "Rendered more hooks than during the previous render" at runtime.
//
// We keep the rest of the config minimal so it can run on every save
// without becoming noise. CI / pre-commit can layer on more rules.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // Base JS rules
  js.configs.recommended,
  // Recommended TS rules (loose — we don't want type errors blocking the
  // dev loop on a 1-person project)
  ...tseslint.configs.recommended,
  // The whole point of this file: catch hook-rule violations at lint time
  // instead of at runtime in production.
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // We use `unknown` casts liberally for IPC payloads from Electron;
      // don't fail the build for unused vars we explicitly ignore with `_`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Same — IPC payloads are typed at the Electron boundary, not here.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Ignore generated / vendored output. Also ignore the
  // veronum-injection bundle: it's a CommonJS-tagged template literal
  // injected into the existing Veronum DMG, with `\${...}` escapes that
  // confuse the JS parser. It's not real source code lint should police.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "next-env.d.ts",
      "veronum-injection/**",
    ],
  }
);
