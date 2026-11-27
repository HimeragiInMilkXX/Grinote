import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {

    qualities: [75, 90, 100],

  },
  experimental: {

    serverActions: { bodySizeLimit: '1gb' },
    // src/proxy.ts runs on every route and buffers the body (default 10 MB): without this, media
    // uploads (materials, task report evidence) over 10 MB arrive truncated
    proxyClientMaxBodySize: '1gb',
    agentUpgrade: "security",

  }
};

export default nextConfig;
