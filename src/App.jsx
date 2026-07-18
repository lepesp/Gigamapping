import { useEffect, lazy, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, onSnapshot, query, where,
  doc, setDoc, serverTimestamp, getDocs, updateDoc, arrayUnion,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import useGigaStore from "./store/useGigaStore";
import { applyTheme, getSavedTheme } from "./themes";
import "./index.css";

// Lazy-load pages for code splitting
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapEditor = lazy(() => import("./pages/MapEditor"));

export default function App() {
  const { user, setUser, currentMapId, currentPageId, setCurrentPageId, maps, setMaps, pendingInvite, setPendingInvite, redeemInvite, unsubscribeAll } = useGigaStore();

  // Browser back button. Innenfor samme kart navigerer den mellom
  // underkart-nivåene; først når man er på toppnivået går den til dashbordet.
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state || {};
      if (currentMapId && state.mapId === currentMapId) {
        // Samme kart — bare bytt nivå
        setCurrentPageId(state.pageId ?? null);
        return;
      }
      if (currentMapId) {
        e.preventDefault();
        unsubscribeAll();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentMapId, setCurrentPageId, unsubscribeAll]);

  // Push history state when opening a map or entering an underkart
  useEffect(() => {
    if (currentMapId) {
      const url = `?map=${currentMapId}${currentPageId ? `&page=${currentPageId}` : ""}`;
      window.history.pushState(
        { mapId: currentMapId, pageId: currentPageId ?? null },
        "",
        url
      );
    } else {
      // Clean URL when back on dashboard
      const url = new URL(window.location);
      if (url.searchParams.has("map") || url.searchParams.has("page")) {
        url.searchParams.delete("map");
        url.searchParams.delete("page");
        window.history.replaceState({}, "", url.pathname + url.search || "/");
      }
    }
  }, [currentMapId, currentPageId]);

  // Load saved theme on mount + check for invite token in URL
  useEffect(() => {
    applyTheme(getSavedTheme());

    // Check URL for invite token
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken) {
      setPendingInvite(inviteToken);
      // Save to localStorage so it survives Google auth redirect
      localStorage.setItem("pendingInvite", inviteToken);
    } else {
      // Restore from localStorage (e.g. after Google redirect)
      const saved = localStorage.getItem("pendingInvite");
      if (saved) {
        setPendingInvite(saved);
      }
    }
  }, []);

  // Auth listener + save user profile to Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Upsert user profile for sharing lookups
        try {
          await setDoc(doc(db, "users", u.uid), {
            uid: u.uid,
            email: (u.email || "").toLowerCase(),
            displayName: u.displayName || "",
            photoURL: u.photoURL || "",
            lastLogin: serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          console.error("Failed to save user profile:", err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Maps listener — query maps where user is a member
  useEffect(() => {
    if (!user) return;

    // One-time migration: find legacy maps owned by user but missing memberUids
    const migrateLegacy = async () => {
      try {
        const legacyQ = query(
          collection(db, "maps"),
          where("ownerId", "==", user.uid)
        );
        const legacySnap = await getDocs(legacyQ);
        for (const mapDoc of legacySnap.docs) {
          const data = mapDoc.data();
          if (!data.memberUids || !data.memberUids.includes(user.uid)) {
            await updateDoc(doc(db, "maps", mapDoc.id), {
              [`members.${user.uid}`]: {
                role: "owner",
                email: (user.email || "").toLowerCase(),
                displayName: user.displayName || user.email || "",
              },
              memberUids: arrayUnion(user.uid),
            });
          }
        }
      } catch (e) { /* ignore migration errors */ }
    };
    migrateLegacy();

    // Single query: all maps where user is in memberUids array
    const mapsQuery = query(
      collection(db, "maps"),
      where("memberUids", "array-contains", user.uid)
    );

    const unsubMaps = onSnapshot(mapsQuery, (snap) => {
      const allMaps = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setMaps(allMaps);
    }, (err) => {
      console.error("Maps listener error:", err);
    });

    return () => unsubMaps();
  }, [user]);

  // Redeem pending invite after login
  useEffect(() => {
    if (user && pendingInvite) {
      redeemInvite(pendingInvite).then((success) => {
        localStorage.removeItem("pendingInvite");
        if (!success) {
          console.warn("Failed to redeem invite");
          setPendingInvite(null);
        }
      });
    }
  }, [user, pendingInvite]);

  const page = !user ? <AuthPage /> : currentMapId ? <MapEditor /> : <Dashboard />;

  return (
    <Suspense fallback={
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", color: "var(--text-muted)", fontSize: 14,
        fontFamily: "Outfit, sans-serif",
      }}>
        Laster...
      </div>
    }>
      {page}
    </Suspense>
  );
}
