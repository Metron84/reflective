import Image from "next/image";
import { cookies } from "next/headers";
import FeedbackWall from "@/components/your-say/FeedbackWall";
import WriteToUs from "@/components/your-say/WriteToUs";
import { yourSayDisplay } from "@/components/your-say/displayFont";
import { FOUNDER_NOTE, YOUR_SAY_COOKIE } from "@/lib/your-say";
import styles from "./page.module.css";

export const metadata = {
  title: { absolute: "Your Say | The Reflective Football" },
  description:
    "What UAE supporters clubs say about The Reflective Football, the good and the critical.",
  alternates: { canonical: "/your-say" },
};

export default async function YourSayPage() {
  const jar = await cookies();
  const initiallySent = jar.get(YOUR_SAY_COOKIE)?.value === "1";
  const lastLine = FOUNDER_NOTE.lines.length - 1;

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Your say</p>
          <h1
            className={`${yourSayDisplay.className} ${styles.headline}`}
            style={{ fontFamily: yourSayDisplay.style.fontFamily }}
          >
            Football is nothing without the fans
          </h1>
        </header>

        <Image
          src={FOUNDER_NOTE.photo.src}
          alt={FOUNDER_NOTE.photo.alt}
          width={FOUNDER_NOTE.photo.width}
          height={FOUNDER_NOTE.photo.height}
          priority
          sizes="(min-width: 680px) 680px, 100vw"
          className={styles.photo}
          style={{ width: "100%", height: "auto" }}
        />

        <section className={styles.note} aria-label="From the founder">
          <p className={styles.noteEyebrow}>From the founder</p>
          <div className={styles.lines}>
            {FOUNDER_NOTE.lines.map((line, index) => (
              <p
                key={line}
                className={index === lastLine ? styles.lineLast : styles.line}
              >
                {line}
              </p>
            ))}
          </div>
          <p className={styles.signature}>{FOUNDER_NOTE.signature}</p>
          <a
            className={styles.link}
            href={FOUNDER_NOTE.link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {FOUNDER_NOTE.link.label}
          </a>
        </section>

        <section id="feedback">
          <FeedbackWall />
        </section>

        <section id="write-to-us">
          <WriteToUs initiallySent={initiallySent} />
        </section>
      </div>
    </main>
  );
}
