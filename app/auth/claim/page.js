import ClaimStep from "@/components/auth/ClaimStep";
import { SITE_URL } from "@/lib/config";
import { safeNextPath } from "@/lib/auth/safe-next";
import { ACCOUNT_PATH } from "@/lib/programme/links";

export const metadata = {
  title: "Setting up your Programme",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClaimPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params?.next === "string" ? params.next : null, ACCOUNT_PATH);
  return <ClaimStep next={next} mainOrigin={SITE_URL} />;
}
