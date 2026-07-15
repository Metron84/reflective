"use client";

import { useEffect, useId, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { filterSuggestionList } from "@/lib/guesser/matching";

const GuessInput = forwardRef(function GuessInput(
  { suggestions, disabled, pending, onSubmit },
  ref
) {
  const listId = useId();
  const rootRef = useRef(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [disambiguation, setDisambiguation] = useState(null);

  const filtered = value.trim()
    ? filterSuggestionList(suggestions, value, 8)
    : [];

  useImperativeHandle(ref, () => ({
    clear() {
      setValue("");
      setDisambiguation(null);
      setOpen(false);
    },
    showDisambiguation(options) {
      setDisambiguation(options);
      setOpen(false);
    },
  }));

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  function pick(option) {
    setValue(option.name);
    setOpen(false);
    setDisambiguation(null);
    onSubmit({ guess: option.name, personId: option.personId });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (disabled || pending || !value.trim()) return;
    setDisambiguation(null);
    onSubmit({ guess: value.trim(), personId: null });
  }

  function onInputKeyDown(e) {
    if (e.key === "ArrowDown" && filtered.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp" && filtered.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setDisambiguation(null);
            }}
            onFocus={() => value.trim() && setOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a player name"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-expanded={open || !!disambiguation}
            disabled={disabled || pending}
            className="w-full rounded border border-paper/25 bg-navy-deep px-4 py-3 text-paper placeholder:text-paper/40 focus:border-paper/60 focus:outline-none disabled:opacity-50"
          />
          {open && filtered.length && !disambiguation ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded border border-paper/20 bg-navy-deep shadow-lg"
            >
              {filtered.map((s, i) => (
                <li key={s.personId} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className={`flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-paper/10 ${
                      i === highlight ? "bg-paper/10" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-paper">
                      {s.name}
                    </span>
                    {s.context ? (
                      <span className="text-xs text-paper/50">{s.context}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={disabled || pending || !value.trim()}
          className="shrink-0 rounded-full bg-signal px-6 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Checking" : "Guess"}
        </button>
      </form>

      {disambiguation?.length ? (
        <div
          role="dialog"
          aria-label="Which player did you mean?"
          className="absolute left-0 right-0 top-full z-30 mt-1 rounded border border-paper/20 bg-navy-deep p-3 shadow-lg"
        >
          <p className="mb-2 px-1 text-xs uppercase tracking-widest text-paper/50">
            Which player did you mean?
          </p>
          <ul className="space-y-1">
            {disambiguation.map((opt) => (
              <li key={opt.personId}>
                <button
                  type="button"
                  onClick={() =>
                    pick({
                      personId: opt.personId,
                      name: opt.name,
                      context: opt.context,
                    })
                  }
                  className="flex w-full flex-col items-start rounded px-3 py-3 text-left transition-colors hover:bg-paper/10"
                >
                  <span className="text-sm font-medium text-paper">
                    {opt.name}
                  </span>
                  {opt.context ? (
                    <span className="text-xs text-paper/50">{opt.context}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
});

export default GuessInput;
