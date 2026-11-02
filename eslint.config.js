import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "public/vue.global.js", "public/tailwind.js", "public/js/**", "public/app.js", "public/sw.js", "tools/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  }
];
