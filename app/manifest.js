export default function manifest() {
  return {
    name: "The Reflective Football",
    short_name: "TRF",
    description: "Football is nothing without the fans.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2EDE4",
    theme_color: "#0A111F",
    icons: [
      {
        src: "/brand/trf-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/trf-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/trf-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/trf-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
