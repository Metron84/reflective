import DoorTile from "./DoorTile";

export default function Doors({ doors }) {
  return (
    <section aria-labelledby="home-doors-title" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <h2
          id="home-doors-title"
          className="max-w-xl text-xs font-semibold uppercase leading-relaxed tracking-[0.18em] text-navy sm:text-sm"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          We document football communities. Starting with the UAE&apos;s supporters clubs.
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-5">
          {doors.map((door, index) => (
            <DoorTile key={door.key} door={door} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}
