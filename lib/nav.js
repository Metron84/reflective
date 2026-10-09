import { OBSERVATORY_ENABLED, SITE_SECTIONS } from "@/lib/config";

/** @deprecated Use SITE_SECTIONS from @/lib/config. Kept for older imports. */
export const PRIMARY_NAV = SITE_SECTIONS.map(({ href, label }) => ({ href, label }));

/** Header, mobile menu and footer. Not the homepage doors. */
export function navSections() {
  if (!OBSERVATORY_ENABLED) return SITE_SECTIONS;
  const item = {
    id: "observatory",
    label: "Observatory",
    href: "/observatory",
    description: "Study the fans.",
  };
  const index = SITE_SECTIONS.findIndex((section) => section.id === "games");
  if (index < 0) return [...SITE_SECTIONS, item];
  return [
    ...SITE_SECTIONS.slice(0, index + 1),
    item,
    ...SITE_SECTIONS.slice(index + 1),
  ];
}

export { SITE_SECTIONS };
