import type { NextConfig } from "next";

const securityHeaders = [
  // Evitar clickjacking — la app no se embebe en iframes externos
  { key: "X-Frame-Options", value: "DENY" },
  // Evitar MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy restrictiva
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permisos de browser — deshabilitar lo que no usamos
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS: HTTPS siempre (Vercel lo da, pero lo reforzamos)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Headers de seguridad en todas las rutas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Imágenes: permitir solo orígenes propios (no CDNs externos)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
