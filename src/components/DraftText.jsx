import { useState, useRef, useEffect, useCallback } from "react";

// Tekstfelt med lokal kladd. Skriving skjer mot lokal state (ingen tapte
// tastetrykk når Firestore-snapshots kommer inn), og lagres debounced og
// på blur/unmount — i stedet for én Firestore-skriving per tastetrykk.
// Eksterne endringer (annen fane/bruker) synces inn når feltet ikke har fokus.
// onCommit kan returnere false for å avvise verdien (f.eks. tomt kartnavn);
// da rulles feltet tilbake til sist lagrede verdi ved blur.
function useDraft(value, onCommit, delay = 600) {
  const external = value ?? "";
  const [draft, setDraft] = useState(external);
  const focused = useRef(false);
  const timer = useRef(null);
  // dirty = brukeren har faktisk skrevet noe ulagret. Uten dette ville et
  // fokusert-men-urørt felt committe en foreldet kladd på blur og overskrive
  // endringer som kom inn fra andre faner/brukere i mellomtiden.
  const latest = useRef({ draft: external, committed: external, dirty: false, onCommit });

  useEffect(() => {
    latest.current.onCommit = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const prevCommitted = latest.current.committed;
    latest.current.committed = external;
    if (!focused.current) {
      setDraft(external);
      latest.current.draft = external;
    } else if (!latest.current.dirty && external !== prevCommitted) {
      // Ekte ekstern endring i et fokusert-men-urørt felt synces inn.
      // Ekko av vår egen (normaliserte) lagring hoppes over — ellers
      // ville f.eks. et etterslepende mellomrom forsvinne under skriving.
      setDraft(external);
      latest.current.draft = external;
    }
  }, [external]);

  const commit = useCallback((revertIfRejected = false) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const { draft: d, committed, dirty } = latest.current;
    if (!dirty || d === committed) return;
    const result = latest.current.onCommit(d);
    if (result === false) {
      if (revertIfRejected) {
        setDraft(committed);
        latest.current.draft = committed;
        latest.current.dirty = false;
      }
      return;
    }
    // onCommit kan returnere den kanoniske verdien som faktisk lagres
    // (f.eks. trimmet kartnavn) — da gjenkjennes snapshot-ekkoet som vårt eget
    latest.current.committed = typeof result === "string" ? result : d;
    latest.current.dirty = false;
  }, []);

  const handleChange = useCallback(
    (e) => {
      const v = e.target.value;
      setDraft(v);
      latest.current.draft = v;
      latest.current.dirty = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(false), delay);
    },
    [commit, delay]
  );

  const handleFocus = useCallback(() => {
    focused.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    focused.current = false;
    commit(true);
  }, [commit]);

  // Flush ved unmount (f.eks. når en modal lukkes rett etter skriving)
  useEffect(() => () => commit(false), [commit]);

  return { draft, handleChange, handleFocus, handleBlur };
}

export function DraftInput({ value, onCommit, delay, onFocus, onBlur, ...props }) {
  const f = useDraft(value, onCommit, delay);
  return (
    <input
      {...props}
      value={f.draft}
      onChange={f.handleChange}
      onFocus={(e) => {
        f.handleFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        f.handleBlur();
        onBlur?.(e);
      }}
    />
  );
}

export function DraftTextarea({ value, onCommit, delay, onFocus, onBlur, ...props }) {
  const f = useDraft(value, onCommit, delay);
  return (
    <textarea
      {...props}
      value={f.draft}
      onChange={f.handleChange}
      onFocus={(e) => {
        f.handleFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        f.handleBlur();
        onBlur?.(e);
      }}
    />
  );
}
