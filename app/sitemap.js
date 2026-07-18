import { SITE_URL } from "@/lib/config";

export default function sitemap() {
  const routes = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/films", changeFrequency: "daily", priority: 0.9 },
    { path: "/reflections", changeFrequency: "daily", priority: 0.9 },
    { path: "/guesser", changeFrequency: "daily", priority: 0.9 },
    { path: "/games", changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
