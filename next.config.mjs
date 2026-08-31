/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The chatbot lives in an iframe embedded on the client's website:
        // it must be framable from any origin. The rest of the app is not.
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          // Toujours revalider côté navigateur (renvoie 304 si inchangé) : le
          // widget.js à jour est servi dès qu'il change. Le CDN peut cacher.
          { key: "Cache-Control", value: "no-cache, s-maxage=600" },
        ],
      },
      {
        // Métadonnées publiques du widget, lues depuis le site du client.
        source: "/api/widget/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;
