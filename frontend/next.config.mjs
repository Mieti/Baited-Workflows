import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  outputFileTracingRoot: path.join(process.cwd())
};

export default nextConfig;
