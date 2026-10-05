import { headers } from "next/headers";
import { profileIsAdmin } from "@/lib/auth/admin";
import { getAuthContext } from "@/lib/auth/session";
import UltimaShell from "@/components/ultima/UltimaShell";
import { ultimaColourHex } from "@/lib/ultima/constants";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { getClubBarContext } from "@/lib/ultima/server/continue";
import { isCommissionerUser, lookupSeat } from "@/lib/ultima/server/db";
import { safeResolve } from "@/lib/ultima/server/safe";

export async function generateMetadata() {
  const app = isUltimaAppHost((await headers()).get("host"));
  return {
    applicationName: "Ultima",
    manifest: app ? "/manifest.webmanifest" : "/ultima/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Ultima",
    },
    icons: {
      icon: [
        { url: "/ultima/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/ultima/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/ultima/apple-touch-icon.png",
    },
  };
}

export const viewport = {
  themeColor: "#12151C",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default async function UltimaLayout({ children }) {
  const auth = await safeResolve(getAuthContext(), {
    user: null,
    profile: null,
    isSignedIn: false,
  });
  const seat =
    auth.isSignedIn && auth.user ? await lookupSeat(auth.user.id) : null;
  const manager = seat?.status === "seated" ? seat.manager : null;
  const club =
    auth.isSignedIn && auth.user
      ? await safeResolve(getClubBarContext(auth.user.id), null)
      : null;

  return (
    <UltimaShell
      manager={Boolean(manager)}
      teamColour={manager ? ultimaColourHex(manager.colour) : null}
      club={
        club ??
        (manager
          ? {
              teamName: manager.team_name || "Ultima",
              seasonLine: "Ultima",
              continue: { label: "Go to hub", href: "/ultima" },
              draftLive: false,
              unread: 0,
            }
          : null)
      }
      isCommissioner={
        Boolean(auth.isSignedIn && auth.user) &&
        (profileIsAdmin(auth.profile) || isCommissionerUser(auth.user.id))
      }
    >
      {children}
    </UltimaShell>
  );
}
