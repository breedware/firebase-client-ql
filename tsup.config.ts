import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"], // Adjust if your main entry file is located elsewhere (e.g., src/index.js)
  format: ["cjs", "esm"],
  outDir: "dist",
  dts: true, // Generates .d.ts files
  clean: true,
  sourcemap: true,
  external: [
    "firebase",
    "firebase/app",
    "firebase/firestore",
    "firebase/functions",
    "@firebase/app",
    "@firebase/firestore",
  ],
});