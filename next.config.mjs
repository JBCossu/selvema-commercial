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
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
