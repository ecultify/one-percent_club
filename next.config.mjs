/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  // Teaser video is now served directly from /public/teaser-video.mp4 (no
  // proxy / no third-party dependency). The previous rewrite to ecultify.com
  // was 403'd by the host's hotlink protection on server-side fetches.
  // To swap the teaser later, just drop a new file at the same /public path.
};

export default nextConfig;
