import Breadcrumb from "@/components/Breadcrumb";
import styles from "./privacy.module.css";

export const metadata = {
  title: "Privacy",
  description:
    "How The Reflective Football handles your data. Who holds it, why we collect it, how long we keep it, and how to ask us to stop.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy" }]} />
      <article className={styles.page}>
        <p className={styles.eyebrow}>The Reflective Football</p>
        <h1 className={styles.title}>Privacy notice</h1>
        <p className={styles.lede}>
          Plain language. If anything here is unclear, email{" "}
          <a href="mailto:melo@thereflectivefootball.com">
            melo@thereflectivefootball.com
          </a>
          .
        </p>
        <p className={styles.updated}>Last updated 14 September 2026.</p>

        <h2>Who controls this data</h2>
        <p>
          The Reflective Football LLC, based in Dubai, is the controller of
          personal data collected on thereflectivefootball.com. Write to Melo
          Doumani at{" "}
          <a href="mailto:melo@thereflectivefootball.com">
            melo@thereflectivefootball.com
          </a>
          .
        </p>

        <h2>Why we collect it</h2>
        <p>We collect only what we need to run the site and the work around it:</p>
        <ul>
          <li>
            Your account: email, preferred name, clubs you choose, and a member
            number, so you can sign in, vote, play, and return to your
            programme.
          </li>
          <li>
            Votes, game plays, and similar records, so results stay fair and
            your progress is saved.
          </li>
          <li>
            Newsletter signup, if you tick that box, so we can email new films,
            games, and results.
          </li>
          <li>
            For All The Fans interest, if you register, so we can email you
            when a night is set.
          </li>
          <li>
            Technical logs such as IP address and a timestamp, so we can stop
            abuse and keep the site working.
          </li>
        </ul>
        <p>
          Registering interest in For All The Fans is not consent to be filmed.
          Appearing on camera is a separate choice, explained in full before
          any night.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account data stays while your account is open. For All The Fans
          interest stays until you ask us to remove it. Event logs used to run
          the nights and the site are kept only as long as we need them for
          that work, then deleted. If you close your account, we delete or
          anonymise what we no longer need, unless the law requires us to keep
          a record.
        </p>

        <h2>Who else receives it</h2>
        <p>We do not sell your details. We use a small set of processors:</p>
        <ul>
          <li>Vercel, to host the website.</li>
          <li>Supabase, to store accounts and the records above.</li>
          <li>Resend, to send sign-in links and emails you have asked for.</li>
          <li>
            Google, only if you choose Google sign-in. Google then processes
            that sign-in on their terms.
          </li>
        </ul>
        <p>
          Venue partners for a For All The Fans night receive only what they
          need to host that night, such as a first name and a headcount. They
          do not receive your email unless you later choose to share it.
        </p>

        <h2>How to withdraw consent</h2>
        <p>
          Email{" "}
          <a href="mailto:melo@thereflectivefootball.com">
            melo@thereflectivefootball.com
          </a>{" "}
          from the address you signed up with. Say what you want stopped:
          For All The Fans emails, the newsletter, or the whole account. We
          will confirm when it is done.
        </p>
        <p>
          You can also ask what we hold, ask us to correct it, or ask us to
          delete it. We will answer as soon as we can.
        </p>

        <h2>Age</h2>
        <p>
          For All The Fans is for people aged 18 and over. Do not register
          interest if you are under 18.
        </p>

        <h2>Cookies</h2>
        <p>
          We use cookies and similar storage to keep you signed in and to
          finish an action you started, such as returning to For All The Fans
          after signup. We do not use advertising trackers on this site.
        </p>
      </article>
    </div>
  );
}
