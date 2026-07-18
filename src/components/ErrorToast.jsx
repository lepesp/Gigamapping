import { useEffect } from "react";
import useGigaStore from "../store/useGigaStore";

// Viser feil fra Firestore-skrivinger og -lyttere. Uten denne forsvant
// feilede lagringer stille mens brukeren trodde alt var lagret.
export default function ErrorToast() {
  const syncError = useGigaStore((s) => s.syncError);
  const setSyncError = useGigaStore((s) => s.setSyncError);

  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(() => setSyncError(null), 8000);
    return () => clearTimeout(t);
  }, [syncError, setSyncError]);

  if (!syncError) return null;

  return (
    <div className="error-toast" role="alert">
      <span>⚠️ {syncError}</span>
      <button onClick={() => setSyncError(null)} title="Lukk">✕</button>
    </div>
  );
}
