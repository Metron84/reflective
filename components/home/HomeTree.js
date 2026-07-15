"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { reflectionsWinnersHeroLine } from "@/lib/config";
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
    dateLine: reflectionsWinnersHeroLine(),
  },
  {
    id: "games",
    href: "/games",
    category: "Games.",
    qualifier: "For the Fun.",
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

export default function HomeTree({ showVotingDate }) {
  const { skipEntrance, animate } = useTreeEntrance();
  const doorRefs = useRef([]);

  useHomeTabOrder(doorRefs);

  const crestClass = skipEntrance
    ? ""
    : animate
      ? styles.enterCrest
      : styles.enterCrestHidden;
  const taglineClass = skipEntrance
    ? ""
    : animate
      ? styles.enterTagline
      : styles.enterTaglineHidden;
  const rootClass = skipEntrance
    ? ""
    : animate
      ? styles.enterRoot
      : styles.enterRootHidden;

  return (
    <section className={`${styles.tree} hero-grain`} aria-label="The Tree">
      <div className={styles.inner}>
        <div className={styles.axis}>
          <div className={styles.crestGlow}>
            <div className={`${styles.crestFrame} ${crestClass}`}>
              <span className={styles.crestShine} aria-hidden="true" />
              <Image
                src="/brand/trf-crest-transparent.png"
                alt="The Reflective Football"
                width={220}
                height={220}
                className={`${styles.crestImage} relative z-10 h-36 w-36 sm:h-44 sm:w-44`}
                priority
              />
            </div>
          </div>

          <h1 className="sr-only">The Reflective Football</h1>
          <p className={`${styles.tagline} ${taglineClass}`}>
            Football is nothing without the fans.
          </p>

          <p className={`${styles.root} ${rootClass}`}>Watch. Vote. Play.</p>
        </div>

        <nav className={styles.doorsMenu} aria-label="The Tree doors">
          {DOORS.map((door, index) => (
            <TreeDoor
              key={door.id}
              ref={(el) => {
                doorRefs.current[index] = el;
              }}
              href={door.href}
              category={door.category}
              qualifier={door.qualifier}
              dateLine={
                door.id === "awards" && showVotingDate ? door.dateLine : null
              }
              doorId={door.id}
              entranceIndex={index}
              skipEntrance={skipEntrance}
              animate={animate}
            />
          ))}
        </nav>
      </div>
    </section>
  );
}
