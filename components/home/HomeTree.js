"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { HOME_HERO_STILL, LALIGA_CAMPAIGN_ENABLED } from "@/lib/config";
import HeroCta from "./HeroCta";
import HeroPromoVideo from "./HeroPromoVideo";
import LaLigaRibbon from "./LaLigaRibbon";
import TreeDoor from "./TreeDoor";
import { useTreeEntrance } from "./useTreeEntrance";
import styles from "./HomeTree.module.css";

const DOORS = [
  {
    id: "films",
    href: "/films",
    category: "Films.",
    qualifier: "From the Fans.",
  },
  {
    id: "awards",
    href: "/reflections",
    category: "Awards.",
    qualifier: "For the Fans.",
  },
  {
    id: "games",
    href: "/games",
    category: "Games.",
    qualifier: "For the Fun.",
  },
  {
    id: "concierge",
    href: "/concierge",
    category: "Concierge.",
    qualifier: "Ask. Find. Watch.",
  },
  {
    id: "archive",
    href: "/archive",
    category: "The Archive.",
    qualifier: "Read. Watch. Listen.",
  },
];

function useHomeTabOrder(doorRefs) {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return undefined;

    const headerFocusables = [
      ...header.querySelectorAll('a[href], button:not([disabled])'),
    ];
    const doors = doorRefs.current.filter(Boolean);

    headerFocusables.forEach((el) => {
      el.setAttribute("data-tree-tab", el.getAttribute("tabindex") ?? "0");
      el.setAttribute("tabindex", "-1");
    });

    const onLastDoorKeyDown = (event) => {
      if (event.key !== "Tab" || event.shiftKey) return;
      event.preventDefault();
      headerFocusables[0]?.focus();
    };

    const onFirstHeaderKeyDown = (event) => {
      if (event.key !== "Tab" || !event.shiftKey) return;
      if (document.activeElement !== headerFocusables[0]) return;
      event.preventDefault();
      doors[doors.length - 1]?.focus();
    };

    doors[doors.length - 1]?.addEventListener("keydown", onLastDoorKeyDown);
    headerFocusables[0]?.addEventListener("keydown", onFirstHeaderKeyDown);

    return () => {
      headerFocusables.forEach((el) => {
        const prev = el.getAttribute("data-tree-tab");
        if (prev === "0" || prev === null) {
          el.removeAttribute("tabindex");
        } else {
          el.setAttribute("tabindex", prev);
        }
        el.removeAttribute("data-tree-tab");
      });
      doors[doors.length - 1]?.removeEventListener("keydown", onLastDoorKeyDown);
      headerFocusables[0]?.removeEventListener("keydown", onFirstHeaderKeyDown);
    };
  }, [doorRefs]);
}

export default function HomeTree({
  doorMeta,
  promoVideoSrc = "/promo/promo.mp4",
  isSignedIn: _isSignedIn = false,
}) {
  const { skipEntrance, animate } = useTreeEntrance();
  const doorRefs = useRef([]);

  useHomeTabOrder(doorRefs);

  const crestClass = skipEntrance
    ? ""
    : animate
      ? styles.enterCrest
      : styles.enterCrestHidden;
  const headlineClass = skipEntrance
    ? ""
    : animate
      ? styles.enterHeadline
      : styles.enterHeadlineHidden;

  return (
    <section className={`${styles.tree} hero-grain`} aria-label="The Tree">
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.floodlightLeft} />
        <div className={styles.floodlightRight} />
      </div>

      {HOME_HERO_STILL ? (
        <div className={styles.footageBand} aria-hidden="true">
          <Image
            src={HOME_HERO_STILL}
            alt=""
            fill
            sizes="100vw"
            className={styles.footageBandImage}
            priority
          />
        </div>
      ) : null}

      <div className={styles.inner}>
        <div className={styles.axis}>
          <div className={styles.heroStage}>
            <div className={styles.heroCopy}>
              <div className={styles.crestFrameWrap}>
                <div className={`${styles.crestFrame} ${crestClass}`}>
                  <span className={styles.crestShine} aria-hidden="true" />
                  <Image
                    src="/brand/trf-crest-transparent.png"
                    alt="The Reflective Football"
                    width={220}
                    height={220}
                    className={`${styles.crestImage} relative z-10 h-20 w-20 sm:h-24 sm:w-24`}
                    priority
                  />
                </div>
              </div>

              <h1 className="sr-only">The Reflective Football</h1>
              <p className={`${styles.fansHeadline} ${headlineClass}`}>
                Football is nothing without the fans.
              </p>
            </div>
            <HeroPromoVideo src={promoVideoSrc} />
          </div>

          <div className={styles.ctaSlot}>
            {LALIGA_CAMPAIGN_ENABLED ? <LaLigaRibbon /> : null}
            <HeroCta />
          </div>
        </div>

        <nav className={styles.doorsMenu} aria-label="The Tree doors">
          {DOORS.filter((door) => {
            const meta = doorMeta?.[door.id];
            return meta?.visible !== false;
          }).map((door, index) => {
            const meta = doorMeta?.[door.id];
            return (
              <TreeDoor
                key={door.id}
                ref={(el) => {
                  doorRefs.current[index] = el;
                }}
                href={meta?.href ?? door.href}
                category={door.category}
                qualifier={door.qualifier}
                statusLine={meta?.statusLine ?? null}
                statusLineShort={meta?.statusLineShort ?? null}
                external={Boolean(meta?.external)}
                doorId={door.id}
                entranceIndex={index}
                skipEntrance={skipEntrance}
                animate={animate}
              />
            );
          })}
        </nav>
      </div>
    </section>
  );
}
