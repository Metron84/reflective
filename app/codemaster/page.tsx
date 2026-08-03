import type { Metadata } from 'next';
import CodemasterApp from '@/components/codemaster/CodemasterApp';
import { getAuthContext } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Codemaster',
  description:
    'Drop the letters back into place and decode two decades of football. Solve every grid to become the Codemaster.',
  alternates: { canonical: '/codemaster' },
  openGraph: {
    title: 'Codemaster',
    description:
      'Drop the letters back into place and decode two decades of football. Solve every grid to become the Codemaster.',
  },
};

export default async function CodemasterPage() {
  const { isSignedIn } = await getAuthContext();

  return (
    <CodemasterApp
      signedIn={isSignedIn}
      signInHref="/signin?next=/codemaster"
      createAccountHref="/signin?next=/codemaster"
    />
  );
}
