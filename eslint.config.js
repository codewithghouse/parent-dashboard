import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "functions/lib"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Cloud Functions backend code legitimately uses `any` for dynamic Firestore
  // doc shapes and Firebase callable payloads — silence the explicit-any rule
  // there so `npm run lint` is clean. The frontend (React) keeps the default
  // strict rule via the first block above.
  {
    files: ["functions/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Functions compile to CommonJS (Node runtime). `require()` is legit
      // for packages that don't ship clean ESM types (e.g. pdf-parse).
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
