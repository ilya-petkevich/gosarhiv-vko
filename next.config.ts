import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // встроенный PostgreSQL (PGlite) грузит wasm с диска — не собирать его в бандл
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  poweredByHeader: false,
  // метаданные (title, description, Open Graph) — сразу в <head> для всех, а не потоком в конце страницы
  htmlLimitedBots: /.*/,
  // загрузка сканов в админке: до 25 МБ на файл, несколько файлов за раз
  experimental: { serverActions: { bodySizeLimit: "100mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
