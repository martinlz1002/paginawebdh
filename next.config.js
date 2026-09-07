// next.config.js
const path = require('path');

console.log(
  "🔑 GOOGLE MAPS ENV EN BUILD:",
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    ? `CONFIGURADA (${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length} caracteres)`
    : "NO CONFIGURADA"
);

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