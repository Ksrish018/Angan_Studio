import type { NextConfig } from "next";
import { config } from "dotenv";

// Locally, secrets live one folder up in the project's .env (never committed).
// On Vercel they come from the project's environment variables instead.
config({ path: "../.env", quiet: true });

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
