import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import useGigaStore from "./store/useGigaStore";
import { applyTheme, getSavedTheme } from "./themes";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import MapEditor from "./pages/MapEditor";
import "./index.css";

export default function App() {
  const { user, setUser, currentMapId, maps, setMaps } = useGigaStore();

  // Load saved theme on mount
  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Maps listener (when logged in)
  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "maps");
    const unsub = onSnapshot(ref, (snap) => {
      const allMaps = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.ownerId === user.uid)
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setMaps(allMaps);
    });
    return () => unsub();
  }, [user]);

  if (!user) return <AuthPage />;
  if (currentMapId) return <MapEditor />;
  return <Dashboard />;
}
