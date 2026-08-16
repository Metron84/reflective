import { SITE_SECTIONS } from "@/lib/config";

/** @deprecated Use SITE_SECTIONS from @/lib/config. Kept for older imports. */
export const PRIMARY_NAV = SITE_SECTIONS.map(({ href, label }) => ({ href, label }));

export { SITE_SECTIONS };
