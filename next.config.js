/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  
}
const path = require('path');  // Asegúrate de importar 'path'
module.exports = {
  webpack(config) {
    config.resolve.alias['@'] = path.join(__dirname); // Asegúrate de que 'path' esté importado al inicio
    return config;
  }
};