// Fast lint tier. Everything here runs without type information, which is
// what keeps it quick enough for a pre-commit hook. The rules that need the
// type checker live in eslint.typed.config.mjs and run on their own script.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      // The repo mixes the Vite front end (browser) with the Express server,
      // api/ handlers and Firebase functions (node).
      globals: { ...globals.browser, ...globals.node },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    plugins: { quality, "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn", // baseline: 1
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      // Baselines measured on install: warn until the count reaches zero,
      // then promote back to "error".
      "prefer-const": "warn", // baseline: 3
      "@typescript-eslint/no-unused-vars": [
        "warn", // baseline: 36
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // baseline: 265
      "@typescript-eslint/no-non-null-assertion": "warn", // baseline: 52
      "@typescript-eslint/no-dynamic-delete": "warn", // baseline: 4
      "@typescript-eslint/no-empty-object-type": "warn", // baseline: 2
      "@typescript-eslint/no-unused-expressions": "warn", // baseline: 1
      "no-control-regex": "warn", // baseline: 1
      "no-irregular-whitespace": "warn", // baseline: 1
      "no-useless-escape": "warn", // baseline: 1
      // The size and complexity budget is all "warn" on purpose. These
      // numbers are a conversation starter about factoring, not a gate --
      // promote one to "error" once the count for it reaches zero.
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],
      "quality/max-lines": ["warn", { max: 350 }], // baseline: 20 files
      "quality/no-direct-console": [
        "warn", // baseline: 77
        { logger: "the project logging helper" },
      ],
      // Presentation layers must go through services/, never lib/firebase.
      "quality/no-direct-data-access": [
        "warn", // baseline: 1 (context/XpContext.tsx)
        {
          modules: ["../lib/firebase", "../../lib/firebase", "@/lib/firebase"],
          bindings: ["db"],
          layers: ["/components/", "/context/"],
          extensions: [".tsx"],
        },
      ],
    },
  },
  {
    // The same file budget for test files, at "warn". Placed after the
    // "error" block so its rules win for files matched by both.
    files: [
      "**/*.test.{ts,tsx,js}",
      "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx,js}",
    ],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { includeTests: true }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx,js}"],
    rules: {
      "max-statements": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".claude/**",
    "node_modules/**",
    "functions/node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "public/**",
    "scripts/**",
    "**/*.tsbuildinfo",
  ]),
]);
