export default function ComingSoon({ title, note }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <h1 className="font-display text-4xl text-navy sm:text-5xl">{title}</h1>
      <p className="mt-4 text-navy/60">{note}</p>
    </div>
  );
}
