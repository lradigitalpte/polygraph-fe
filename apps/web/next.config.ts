import "@frontend/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Allow HMR/dev assets when the dev server is opened via a LAN/WSL IP instead of localhost.
  allowedDevOrigins: ["172.22.48.1"],
};

export default nextConfig;
