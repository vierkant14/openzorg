/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output only in Docker (CI sets STANDALONE=true)
  ...(process.env.STANDALONE === "true" ? { output: "standalone" } : {}),
  transpilePackages: [
    "@openzorg/shared-domain",
    "@openzorg/shared-config",
    "@openzorg/shared-ui",
  ],
};

export default nextConfig;
