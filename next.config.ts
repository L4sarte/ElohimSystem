import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Hosts autorizados para el optimizador de imágenes de Next (Supabase Storage).
    // URLs de otros hosts se renderizan sin optimizar (unoptimized) vía canOptimizeImageUrl.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
};

export default nextConfig;
