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
      "react-hooks/exhaustive-deps": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      // Rules at zero are "error"; the ones still at "warn" are tracked in docs/lint-debt.md --
      // promote each back to "error" when its count reaches zero.
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // baseline: 47 (docs/lint-debt.md)
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "no-control-regex": "error",
      "no-irregular-whitespace": "error",
      "no-useless-escape": "error",
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
      "quality/max-lines": ["warn", { max: 350 }], // baseline: 12 files (docs/lint-debt.md)
      "quality/no-direct-console": ["error", { logger: "logger from lib/logger.js" }],
      // Presentation layers must go through services/, never lib/firebase.
      "quality/no-direct-data-access": [
        "error",
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
    // The log adapter itself. This block MUST come after the block that turns
    // the rule on, or the "error" above silently overrides this "off".
    files: ["lib/logger.js"],
    rules: { "quality/no-direct-console": "off" },
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
