import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { nextRuntime }) {
    // @supabase/supabase-js references process.version at import time.
    // Vercel Edge Runtime has no `process` object, crashing the middleware.
    // Replace the reference with a static string at build time so it never
    // tries to read the missing global at runtime.
    if (nextRuntime === 'edge') {
      const { DefinePlugin } = require('webpack')
      config.plugins.push(
        new DefinePlugin({ 'process.version': JSON.stringify('v18.0.0') })
      )
    }
    return config
  },
}

export default nextConfig
