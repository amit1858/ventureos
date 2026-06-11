/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ventureos/contracts',
    '@ventureos/credentials',
    '@ventureos/personalab',
    '@ventureos/security',
    '@ventureos/providers-core',
    '@ventureos/providers-openai',
    '@ventureos/providers-anthropic',
    '@ventureos/providers-gemini',
    '@ventureos/providers-azure-openai',
  ],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
