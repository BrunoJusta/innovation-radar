import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Usados só na rota /api/preparar; ficam fora do bundle (o linkedom tem dependências opcionais)
  serverExternalPackages: ["linkedom", "@mozilla/readability"],
  // O radar é só para uso interno: nada é indexado por motores de busca
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
