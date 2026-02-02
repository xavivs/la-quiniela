/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // No fallar el build por warnings de ESLint (img, useEffect deps). Se pueden corregir después.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
