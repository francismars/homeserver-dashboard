/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for Docker optimization
  webpack: (config, { isServer }) => {
    // Externalize @synonymdev/pubky on the server side because it uses WASM
    // which can only run in the browser
    if (isServer) {
      config.externals.push('@synonymdev/pubky');
    }

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;

