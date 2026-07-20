/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
