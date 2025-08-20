/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Remove assetPrefix and basePath for automatic detection
  // The dashboard will automatically detect its base URL from window.location.origin
}

module.exports = nextConfig
