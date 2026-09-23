import { headers } from "next/headers";
import SignInForm from "@/components/auth/SignInForm";
import { isFatfNext } from "@/lib/fatf";
import { isUltimaAppHost } from "@/lib/ultima/host";

export async function generateMetadata() {
  const ultimaApp = isUltimaAppHost((await headers()).get("host"));
  return {
    title: ultimaApp ? "Sign in to Ultima" : "Sign in",
    robots: { index: false },
  };
}

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const ultimaApp = isUltimaAppHost((await headers()).get("host"));
  const nextPath =
    typeof params?.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";
  const fatfFlow = isFatfNext(nextPath) || params?.intent === "fatf";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <SignInForm nextPath={nextPath} fatfFlow={fatfFlow} ultimaApp={ultimaApp} />
    </div>
  );
}
