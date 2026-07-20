/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite subir uma segunda instância (ex.: testes e2e) sem brigar pelo mesmo
  // .next do dev server. Sem a variável, o comportamento é o padrão.
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
