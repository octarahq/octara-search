import type { NextConfig } from "next";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_PORT = process.env.API_PORT || 3001;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${API_PORT}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
