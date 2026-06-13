/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Convex backend package ships TS source for its generated API; let Next
  // transpile it from the workspace instead of expecting a prebuilt dist.
  transpilePackages: ["@activitytrack/backend", "@activitytrack/shared"],
};

export default nextConfig;
