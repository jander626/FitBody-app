import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  headers: async () => [
    {
      // El service worker debe poder controlar toda la app y no quedarse
      // pegado en una versión vieja tras un deploy.
      source: "/sw.js",
      headers: [
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    },
  ],
};

export default nextConfig;
