import { notFound } from "next/navigation";
import FatfView from "@/components/fatf/FatfView";
import { getAuthContext } from "@/lib/auth/session";
import { FATF_ENABLED, FATF_INDEXABLE } from "@/lib/config";
import { FATF_META_DESCRIPTION, FATF_PATH } from "@/lib/fatf";
import { createClient } from "@/lib/supabase/server";

const TITLE = "For All The Fans | The Reflective Football";

export const metadata = {
  title: {
    absolute: TITLE,
  },
  description: FATF_META_DESCRIPTION,
  alternates: { canonical: FATF_PATH },
  robots: FATF_INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: FATF_META_DESCRIPTION,
    url: FATF_PATH,
    images: [
      {
        url: "/for-all-the-fans/opengraph-image",
        width: 1200,
        height: 630,
        alt: "For All The Fans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: FATF_META_DESCRIPTION,
    images: ["/for-all-the-fans/opengraph-image"],
  },
};

async function getFatfState(userId) {
  if (!userId) return { interested: false, role: null };
  const supabase = await createClient();
  if (!supabase) return { interested: false, role: null };
  const { data, error } = await supabase
    .from("profiles")
    .select("fatf_interest, fatf_role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { interested: false, role: null };
  return {
    interested: Boolean(data.fatf_interest),
    role: data.fatf_role ?? null,
  };
}

export default async function ForAllTheFansPage() {
  if (!FATF_ENABLED) {
    notFound();
  }

  const { isSignedIn, user } = await getAuthContext();
  const { interested, role } = await getFatfState(user?.id);

  return (
    <FatfView signedIn={isSignedIn} interested={interested} role={role} />
  );
}
