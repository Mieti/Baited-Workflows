import path from "node:path";

const apiProxyUrl = (process.env.API_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  outputFileTracingRoot: path.join(process.cwd()),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
