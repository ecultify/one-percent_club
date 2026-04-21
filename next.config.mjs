/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  // Proxy the externally-hosted teaser video through our own origin so the
  // browser sees it as same-origin (no CORS preflight, no cross-origin block).
  // The <video> tag in GameFlow.tsx points at /teaser-video.mp4 and Next.js
  // rewrites that to the ecultify.com URL on the server side.
  async rewrites() {
    return [
      {
        source: "/teaser-video.mp4",
        destination:
          "https://ecultify.com/wp-content/uploads/2026/04/1-Teaser-Final-Video.mp4",
      },
    ];
  },
};

export default nextConfig;
