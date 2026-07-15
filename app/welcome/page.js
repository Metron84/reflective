import { redirect } from "next/navigation";
import WelcomeForm from "@/components/auth/WelcomeForm";
import { getClubOptions } from "@/lib/auth/clubs";
import { getAuthContext } from "@/lib/auth/session";

export const metadata = {
  title: "Welcome",
  robots: { index: false },
};

export default async function WelcomePage({ searchParams }) {
  const params = await searchParams;
  const nextPath =
    typeof params?.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";

  const { user, profile, isSignedIn } = await getAuthContext();
  if (!isSignedIn) redirect(`/signin?next=${encodeURIComponent("/welcome")}`);
  if (profile?.welcome_completed) redirect(nextPath);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <WelcomeForm
        email={user.email ?? ""}
        clubOptions={getClubOptions()}
        nextPath={nextPath}
      />
    </div>
  );
}
