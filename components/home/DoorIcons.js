const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconFilms({ className }) {
  return (
    <svg
      className={className}
      width={28}
      height={28}
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <rect x={4} y={7} width={20} height={14} rx={1.5} {...STROKE} />
      <path d="M4 11h20" {...STROKE} />
      <circle cx={8} cy={9.5} r={1} fill="currentColor" stroke="none" />
      <circle cx={11} cy={9.5} r={1} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAwards({ className }) {
  return (
    <svg
      className={className}
      width={28}
      height={28}
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <path
        d="M14 4c-3.2 0-5.5 2.4-5.5 5.2 0 2.2 1.2 4 3 5.1L10 22h8l-1.5-7.7c1.8-1.1 3-2.9 3-5.1C19.5 6.4 17.2 4 14 4z"
        {...STROKE}
      />
      <path d="M10 22h8" {...STROKE} />
      <path d="M11.5 24.5h5" {...STROKE} />
    </svg>
  );
}

export function IconGames({ className }) {
  const tiles = [
    [7, 7],
    [14, 7],
    [21, 7],
    [7, 14],
    [14, 14],
    [21, 14],
  ];
  return (
    <svg
      className={className}
      width={28}
      height={28}
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      {tiles.map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx - 2.75}
          y={cy - 2.75}
          width={5.5}
          height={5.5}
          rx={1.2}
          {...STROKE}
        />
      ))}
    </svg>
  );
}

export function IconArrow({ className }) {
  return (
    <svg
      className={className}
      width={32}
      height={16}
      viewBox="0 0 32 16"
      aria-hidden="true"
    >
      <path d="M2 8h24" {...STROKE} />
      <path d="M20 3.5L26.5 8 20 12.5" {...STROKE} />
    </svg>
  );
}

export const DOOR_ICONS = {
  films: IconFilms,
  awards: IconAwards,
  games: IconGames,
};
