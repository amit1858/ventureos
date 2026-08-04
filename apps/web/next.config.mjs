/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@foundry/contracts',
    '@foundry/credentials',
    '@foundry/personalab',
    '@foundry/security',
    '@foundry/providers-core',
    '@foundry/providers-openai',
    '@foundry/providers-anthropic',
    '@foundry/providers-gemini',
    '@foundry/providers-azure-openai',
  ],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
