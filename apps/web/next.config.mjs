import { execSync } from "child_process";

// Inject git SHA + version at build time
let gitSha = "dev";
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Not in a git repo (Docker build) — use env var or fallback
  gitSha = process.env.GIT_SHA || "docker";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output only in Docker (CI sets STANDALONE=true)
  ...(process.env.STANDALONE === "true" ? { output: "standalone" } : {}),
  transpilePackages: [
    "@openzorg/shared-domain",
    "@openzorg/shared-config",
    "@openzorg/shared-ui",
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "0.2.0",
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
};

export default nextConfig;
