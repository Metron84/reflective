import { getAuthContext } from "@/lib/auth/session";
import { loadHeaderProgramme } from "@/lib/account/header-status";
import SiteHeaderClient from "./SiteHeaderClient";

export default async function SiteHeader() {
  const auth = await getAuthContext();
  const programme =
    auth?.isSignedIn && auth?.profile ? await loadHeaderProgramme(auth.user, auth.profile) : null;
  return <SiteHeaderClient auth={auth} programme={programme} />;
}
