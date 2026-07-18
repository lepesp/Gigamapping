import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import useGigaStore from "./store/useGigaStore";
import { applyTheme, getSavedTheme } from "./themes";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import MapEditor from "./pages/MapEditor";
import ErrorToast from "./components/ErrorToast";
import "./index.css";

export default function App() {
  const user = useGigaStore((s) => s.user);
  const currentMapId = useGigaStore((s) => s.currentMapId);
  const maps = useGigaStore((s) => s.maps);
  const mapsLoaded = useGigaStore((s) => s.mapsLoaded);
  const setUser = useGigaStore((s) => s.setUser);
  const setMaps = useGigaStore((s) => s.setMaps);
  const setSyncError = useGigaStore((s) => s.setSyncError);
  const closeMap = useGigaStore((s) => s.closeMap);
  const resetSession = useGigaStore((s) => s.resetSession);

  // Load saved theme on mount
  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  // Auth-lytter. Ved EKTE utlogging (overgang fra innlogget) nullstilles
  // session-staten og URL-hashen, slik at neste konto aldri arver forrige
  // brukers åpne kart. En fersk besøkende med delt #mapId-lenke skal
  // derimot beholde hashen gjennom innloggingen.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        resetSession();
        if (wasSignedIn.current && window.location.hash) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
      }
      wasSignedIn.current = !!u;
      setUser(u);
    });
    return () => unsub();
  }, [setUser, resetSession]);

  // Kartliste med server-side eierskapsfilter — må matche firestore.rules:
  // en ufiltrert collection-lytter ville blitt avvist av eier-reglene.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "maps"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const myMaps = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setMaps(myMaps);
      },
      (err) => {
        console.error("Kartliste-lytter feilet:", err);
        setSyncError(err?.message || "Kunne ikke hente kartene dine");
      }
    );
    return () => unsub();
  }, [user, setMaps, setSyncError]);

  // URL-hash → åpent kart: F5 gjenåpner kartet og tilbakeknappen lukker det.
  // Venter på kartlisten så vi bare abonnerer på kart brukeren faktisk eier.
  useEffect(() => {
    if (!user || !mapsLoaded) return;
    const applyHash = () => {
      const id = window.location.hash.slice(1);
      const state = useGigaStore.getState();
      if (id && id !== state.currentMapId) {
        if (state.maps.some((m) => m.id === id)) {
          state.subscribeToMap(id);
        } else {
          // Ukjent kart i lenken: gjenopprett hashen til kartet som faktisk
          // er åpent (eller fjern den) så URL og state ikke desynces.
          const keep = state.currentMapId ? `#${state.currentMapId}` : "";
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search + keep
          );
          state.setSyncError("Fant ikke kartet i lenken.");
        }
      } else if (!id && state.currentMapId) {
        state.closeMap();
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [user, mapsLoaded]);

  // Åpent kart → URL-hash. Guarded på user+mapsLoaded slik at effekten
  // aldri stripper en deep-link-hash FØR gjenopprettingen har fått kjørt
  // (ellers er F5/delte lenker ødelagt). Leser fersk currentMapId fra
  // storen fordi subscribeToMap kan ha endret den i samme commit.
  useEffect(() => {
    if (!user || !mapsLoaded) return;
    const liveMapId = useGigaStore.getState().currentMapId;
    const inHash = window.location.hash.slice(1);
    if (liveMapId && inHash !== liveMapId) {
      window.location.hash = liveMapId;
    } else if (!liveMapId && inHash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, [currentMapId, user, mapsLoaded]);

  // Hvis det åpne kartet BLE slettet fra en annen fane/sesjon: tilbake til
  // Dashboard i stedet for å skrive videre under et ikke-eksisterende doc.
  // confirmedMapId husker at kartet faktisk har vært observert i listen —
  // et NYOPPRETTET kart settes som åpent FØR snapshotet rekker å inkludere
  // det, og skal da vente på snapshotet, ikke lukkes umiddelbart.
  const confirmedMapId = useRef(null);
  useEffect(() => {
    if (!currentMapId || !mapsLoaded) return;
    if (maps.some((m) => m.id === currentMapId)) {
      confirmedMapId.current = currentMapId;
    } else if (confirmedMapId.current === currentMapId) {
      // Var bekreftet til stede og forsvant nå → faktisk slettet
      confirmedMapId.current = null;
      closeMap();
      setSyncError("Kartet du hadde åpent finnes ikke lenger.");
    }
    // Ellers: ferskt kart som ennå ikke er i snapshotet — vent.
  }, [currentMapId, mapsLoaded, maps, closeMap, setSyncError]);

  if (!user) return <AuthPage />;
  return (
    <>
      {currentMapId ? <MapEditor /> : <Dashboard />}
      <ErrorToast />
    </>
  );
}
