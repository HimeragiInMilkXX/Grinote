import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {

    qualities: [75, 90, 100],

  },
  experimental: {

    serverActions: { bodySizeLimit: '1gb' },
    agentUpgrade: "security",

  }
};

export default nextConfig;
