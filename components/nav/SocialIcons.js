export function InstagramIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.8 8.001a2.5 2.5 0 0 0-1.76-1.765C18.12 6 12 6 12 6s-6.12 0-8.04.236A2.5 2.5 0 0 0 2.2 8.001 26.3 26.3 0 0 0 2 12a26.3 26.3 0 0 0 .2 3.999 2.5 2.5 0 0 0 1.76 1.765C5.88 18 12 18 12 18s6.12 0 8.04-.236a2.5 2.5 0 0 0 1.76-1.765A26.3 26.3 0 0 0 22 12a26.3 26.3 0 0 0-.2-3.999ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  );
}

export function LinkedInIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.98 3.5a1.75 1.75 0 1 1-.02 3.5 1.75 1.75 0 0 1 .02-3.5ZM3.5 8.75h2.96V20.5H3.5V8.75Zm5.32 0H11.7v1.59h.04c.45-.86 1.55-1.77 3.19-1.77 3.41 0 4.04 2.24 4.04 5.16V20.5h-2.96v-5.84c0-1.39-.03-3.18-1.94-3.18-1.94 0-2.24 1.52-2.24 3.09V20.5H8.82V8.75Z" />
    </svg>
  );
}

export const SOCIAL_ICONS = {
  youtube: YouTubeIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
};
