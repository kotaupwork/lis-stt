// eslint.config.js — Flat ESLint config (ESLint 9+)
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Disallow any — prefer unknown + narrowing
      "@typescript-eslint/no-explicit-any": "error",
      // Require explicit return types on public functions
      "@typescript-eslint/explicit-function-return-type": ["warn", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      // Disallow floating promises
      "@typescript-eslint/no-floating-promises": "error",
      // Require await in async functions
      "@typescript-eslint/require-await": "warn",
      // No unused vars (with underscore prefix exception)
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    // Ignore compiled output and node_modules
    ignores: ["dist/", "node_modules/"],
  }
);
