import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["maplibre-gl"],
};

export default nextConfig;
