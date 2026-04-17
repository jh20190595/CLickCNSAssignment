import type { NextConfig } from "next";
import path from "node:path";
import { readFileSync } from "node:fs";

const desktopPkg = path.resolve(__dirname, "..", "desktop", "package.json");
let appVersion = "dev";
try {
  appVersion = JSON.parse(readFileSync(desktopPkg, "utf8")).version;
} catch {}

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname),
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
