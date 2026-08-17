import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Typing conventions. eslint-config-next already enables both of these; they are
  // pinned here so a preset change can't silently drop them, and so the intent is
  // visible in our own config rather than inherited three layers up.
  //
  // What these rules can't express — "don't reach for `unknown` when you actually
  // know the shape" — is a judgment call, and lives in the `typescript-typing`
  // skill instead. ("Narrow `unknown` before use" needs no rule: the compiler
  // already refuses every operation on it until you do.)
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Keep the escape hatches from quietly undoing the rule above. A written
      // reason is required rather than a flat ban, so the rare genuine case (a
      // wrong third-party type) stays possible but reviewable. Set
      // "ts-expect-error": true to ban it outright.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
