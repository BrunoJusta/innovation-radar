import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O radar é só para uso interno: nada é indexado por motores de busca
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
