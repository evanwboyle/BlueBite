// Vercel serverless entry: the compiled Express app (see vercel.json for the build order).
// The root package is ESM and backend/dist is CommonJS, so the extension is required and the app
// arrives as `module.exports.default`.
// @ts-ignore - declarations are not emitted for the production build
import backend from "../backend/dist/index.js";

export default (backend as { default: unknown }).default;
