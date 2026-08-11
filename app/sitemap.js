import { LALIGA_CAMPAIGN_ENABLED, SITE_URL, STAND_ENABLED } from "@/lib/config";
import { getAllEntries } from "@/lib/archive/index";

export default function sitemap() {
  const lastModified = new Date();

  const routes = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/films", changeFrequency: "daily", priority: 0.9 },
    { path: "/reflections", changeFrequency: "daily", priority: 0.9 },
    { path: "/guesser", changeFrequency: "daily", priority: 0.9 },
    { path: "/codemaster", changeFrequency: "weekly", priority: 0.8 },
    { path: "/games", changeFrequency: "weekly", priority: 0.7 },
    { path: "/concierge", changeFrequency: "weekly", priority: 0.8 },
    { path: "/archive", changeFrequency: "weekly", priority: 0.85 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
    ...(STAND_ENABLED
      ? [{ path: "/stand", changeFrequency: "daily", priority: 0.8 }]
      : []),
    ...(LALIGA_CAMPAIGN_ENABLED
      ? [{ path: "/laliga", changeFrequency: "weekly", priority: 0.8 }]
      : []),
  ];

  const staticRoutes = routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));

  const archiveEntries = getAllEntries().map((entry) => ({
    url: `${SITE_URL}/archive/${entry.id}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...archiveEntries];
}
