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
          // no-store : le navigateur NE garde JAMAIS widget.js en cache → toute
          // correction est prise en compte au rechargement suivant, sans hard
          // refresh. (s-maxage laisse quand même un CDN mutualiser.)
          { key: "Cache-Control", value: "no-store, must-revalidate, s-maxage=300" },
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
