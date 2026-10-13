import { getAuthContext } from "@/lib/auth/session";
import SiteHeaderClient from "./SiteHeaderClient";

export default async function SiteHeader() {
  const auth = await getAuthContext();
  return <SiteHeaderClient auth={auth} />;
}
