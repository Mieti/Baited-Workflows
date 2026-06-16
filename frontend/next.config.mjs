import path from "node:path";

const apiProxyUrl = process.env.API_PROXY_URL?.trim();

if (!apiProxyUrl && process.env.VERCEL) {
  throw new Error("API_PROXY_URL must be configured for Vercel deployments.");
}

const resolvedApiProxyUrl = (apiProxyUrl || "http://127.0.0.1:8000").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  outputFileTracingRoot: path.join(process.cwd()),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${resolvedApiProxyUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
