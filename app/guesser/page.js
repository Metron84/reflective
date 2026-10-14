import Breadcrumb from "@/components/Breadcrumb";
import BuzzerGame from "@/components/guesser/BuzzerGame";
import { getAuthContext } from "@/lib/auth/session";
import { GUESSER_STRAPLINE } from "@/lib/config";
import { puzzleNumber } from "@/lib/guesser/config";
import { getAutocompleteList } from "@/lib/guesser/buzzer/pool";
import { dubaiDay } from "@/lib/play/week.js";

export const metadata = {
  title: "The Guesser",
  description: "Five footballers a day. Clues land every five seconds and the points drain. Tap to answer.",
  alternates: { canonical: "/guesser" },
  openGraph: {
    title: "The Guesser | The Reflective Football",
    description: "Five players, twenty points, one buzzer. A new board every day.",
  },
  twitter: {
    title: "The Guesser | The Reflective Football",
    description: "Five players, twenty points, one buzzer. A new board every day.",
  },
};

export const dynamic = "force-dynamic";

export default async function GuesserPage() {
  const { isSignedIn } = await getAuthContext();
  const number = puzzleNumber(dubaiDay());

  return (
    <div>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "The Guesser" }]} />
      <section className="bg-gradient-to-b from-navy to-navy-deep px-4 pb-8 pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-paper/70">The Reflective Football</p>
        <h1 className="mt-4 font-display text-5xl text-paper sm:text-6xl">The Guesser</h1>
        <p className="mt-3 text-base text-paper/80">{GUESSER_STRAPLINE}</p>
        <p className="sr-only">Board number {number}</p>
        <div className="mt-8">
          <BuzzerGame names={getAutocompleteList()} signedIn={isSignedIn} />
        </div>
      </section>
    </div>
  );
}
