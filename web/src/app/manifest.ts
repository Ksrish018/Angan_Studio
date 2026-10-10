import type { MetadataRoute } from "next";

// Lets Nikhil and the designers "Add to Home Screen" so Concierge opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aangan Concierge",
    short_name: "Concierge",
    description: "Every enquiry answered. Every designer prepared.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2ec",
    theme_color: "#f6f2ec",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
