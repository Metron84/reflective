"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

function Rise({ index, reduce, as = "div", className, children }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
    >
      {children}
    </Tag>
  );
}

export default function Hero({ imageSrc }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate flex min-h-[70svh] items-center justify-center overflow-hidden bg-navy lg:min-h-[80vh]"
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-30 object-cover"
          style={{ objectPosition: "center" }}
        />
      ) : null}
      <div className="absolute inset-0 -z-20 bg-navy/75" aria-hidden />
      <div className="film-grain absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <Rise index={0} reduce={reduce}>
          <Image
            src="/brand/trf-crest-transparent.png"
            alt="The Reflective Football crest"
            width={128}
            height={128}
            priority
            className="h-24 w-24 lg:h-32 lg:w-32"
          />
        </Rise>
        <Rise index={1} reduce={reduce} as="h1" className="mt-8">
          <span
            id="home-hero-title"
            className="block font-display text-[clamp(2rem,8.5vw,4.75rem)] uppercase leading-[0.98] tracking-tight text-paper"
          >
            Football is nothing without the fans
          </span>
        </Rise>
        <Rise
          index={2}
          reduce={reduce}
          as="p"
          className="mt-5 text-base text-paper/80 sm:text-lg"
        >
          We connect the football fan community.
        </Rise>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-signal" aria-hidden />
    </section>
  );
}
