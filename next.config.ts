import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // 解决 ali-oss 的 proxy-agent 依赖问题
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 将 proxy-agent 标记为外部模块，避免打包错误
      config.externals = config.externals || [];
      config.externals.push({
        'proxy-agent': 'commonjs proxy-agent',
      });
    }
    return config;
  },
  output: 'standalone', // <--- 加上这一行
};

export default nextConfig;
