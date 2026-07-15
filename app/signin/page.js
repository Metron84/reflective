import SignInForm from "@/components/auth/SignInForm";

export const metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const nextPath =
    typeof params?.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <SignInForm nextPath={nextPath} />
    </div>
  );
}
