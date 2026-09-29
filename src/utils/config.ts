// Same-origin /api in production builds (Vercel serves the API next to the frontend); localhost in dev.
export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
