import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `lib/server/**` guards itself with `import "server-only"`, whose default
      // export throws on purpose. Next resolves it to empty.js under the
      // "react-server" condition; Vitest resolves conditions like plain Node and
      // would hit the throwing entry, so point it at the same empty module.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
