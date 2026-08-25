const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconShell({ children, className, size = 24 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function MicIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <rect x={9} y={3} width={6} height={11} rx={3} {...STROKE} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" {...STROKE} />
      <path d="M12 17.5V21" {...STROKE} />
      <path d="M8.5 21h7" {...STROKE} />
    </IconShell>
  );
}

export function CameraIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <rect x={2.5} y={6.5} width={14} height={11} rx={1.5} {...STROKE} />
      <path d="M16.5 10.5l5-2.5v8l-5-2.5z" {...STROKE} />
      <circle cx={9.5} cy={12} r={2.25} {...STROKE} />
    </IconShell>
  );
}

export function ReelIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <rect x={4} y={4} width={16} height={16} rx={2} {...STROKE} />
      <circle cx={9} cy={9} r={2} {...STROKE} />
      <circle cx={15} cy={9} r={2} {...STROKE} />
      <circle cx={9} cy={15} r={2} {...STROKE} />
      <circle cx={15} cy={15} r={2} {...STROKE} />
      <path d="M9 9h6M9 15h6M9 9v6M15 9v6" {...STROKE} />
    </IconShell>
  );
}

export function BroadcastIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <circle cx={12} cy={14} r={2} {...STROKE} />
      <path d="M8.2 10.2a5.5 5.5 0 0 1 7.6 0" {...STROKE} />
      <path d="M5.5 7.5a9 9 0 0 1 13 0" {...STROKE} />
      <path d="M12 16v5" {...STROKE} />
    </IconShell>
  );
}

export function EyeIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" {...STROKE} />
      <circle cx={12} cy={12} r={2.5} {...STROKE} />
    </IconShell>
  );
}

export function PlayIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <circle cx={12} cy={12} r={8.5} {...STROKE} />
      <path d="M10 8.5l7 3.5-7 3.5z" {...STROKE} />
    </IconShell>
  );
}

export function ClockIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <circle cx={12} cy={12} r={8.5} {...STROKE} />
      <path d="M12 7.5V12l3.2 2" {...STROKE} />
    </IconShell>
  );
}

export function GlobeIcon({ className, size }) {
  return (
    <IconShell className={className} size={size}>
      <circle cx={12} cy={12} r={8.5} {...STROKE} />
      <path d="M3.5 12h17" {...STROKE} />
      <path d="M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5" {...STROKE} />
      <path d="M12 3.5c-2.4 2.6-3.6 5.4-3.6 8.5s1.2 5.9 3.6 8.5" {...STROKE} />
    </IconShell>
  );
}
