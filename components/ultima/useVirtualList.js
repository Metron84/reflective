"use client";

import { useEffect, useRef, useState } from "react";

export default function useVirtualList({ count, rowHeight, overscan = 10 }) {
  const ref = useRef(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 24) });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    function measure() {
      const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
      const visible = Math.ceil(el.clientHeight / rowHeight) + overscan * 2;
      const end = Math.min(count, start + Math.max(visible, 1));
      setRange((current) =>
        current.start === start && current.end === end ? current : { start, end },
      );
    }

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [count, overscan, rowHeight]);

  return {
    ref,
    start: range.start,
    end: range.end,
    height: count * rowHeight,
    offset: range.start * rowHeight,
  };
}
