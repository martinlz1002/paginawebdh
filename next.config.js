// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
reactStrictMode: true,
// Limitar workers para evitar OOM en build
experimental: {
cpus: 1,
},
webpack(config) {
config.resolve.alias['@'] = path.resolve(__dirname);
return config;
},
};

module.exports = nextConfig;