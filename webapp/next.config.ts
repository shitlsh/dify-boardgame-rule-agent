import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // allow large file uploads (ZIP / PDF rulebooks)
    },
  },
}

export default nextConfig
