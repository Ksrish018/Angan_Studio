import type { MetadataRoute } from "next";

// Callers' details live here: keep the whole app out of search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
