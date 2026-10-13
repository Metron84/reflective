import { SOCIAL_LINKS } from "@/lib/config";

/** The four doors. Header, mobile menu, footer and homepage all read this. */
export const DOORS = [
  { key: "games", label: "Games", href: "/games" },
  { key: "competitions", label: "Competitions", href: "/competitions" },
  { key: "events", label: "Events", href: "/events" },
  { key: "observatory", label: "Observatory", href: "/observatory" },
];

export const SOCIALS = [
  { key: "youtube", label: "YouTube", href: SOCIAL_LINKS.youtube },
  { key: "instagram", label: "Instagram", href: SOCIAL_LINKS.instagram },
];

export const PARTNERS = {
  label: "Partners",
  href: "mailto:partnerships@thereflectivefootball.com?subject=Partnership",
};

export const LINKEDIN = {
  key: "linkedin",
  label: "LinkedIn",
  href: SOCIAL_LINKS.linkedin,
};

export function isActivePath(pathname, href) {
  if (!href || href.startsWith("mailto:")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
