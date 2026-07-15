import { getAuthContext } from "@/lib/auth/session";
import HeaderShell from "./HeaderShell";

export default async function Header() {
  const auth = await getAuthContext();
  return <HeaderShell auth={auth} />;
}
