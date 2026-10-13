"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

export default function DoorTile({ door, index }) {
  const reduce = useReducedMotion();
  const { image } = door;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : (index % 4) * 0.08, ease: "easeOut" }}
    >
      <Link
        href={door.href}
        prefetch={false}
        className="group relative block aspect-video overflow-hidden bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:aspect-[3/4]"
      >
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, 100vw"
            className="object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.04] group-active:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100"
            style={{ objectPosition: image.focus }}
          />
        ) : (
          <div className="film-grain absolute inset-0" aria-hidden />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-navy via-navy/70 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-5 lg:p-4">
          <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-2xl uppercase leading-none tracking-wide text-paper [overflow-wrap:normal] [word-break:normal] sm:text-3xl lg:text-[clamp(1.25rem,2.2vw,1.875rem)] lg:tracking-normal">
            {door.label}
            {door.live ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-signal"
                role="img"
                aria-label="Live"
              />
            ) : null}
          </h3>
          <p className="mt-2 text-sm leading-snug text-paper/85">{door.status}</p>
        </div>
      </Link>
    </motion.li>
  );
}
