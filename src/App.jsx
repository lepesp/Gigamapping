import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, onSnapshot, query, where,
  doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import useGigaStore from "./store/useGigaStore";
import { applyTheme, getSavedTheme } from "./themes";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import MapEditor from "./pages/MapEditor";
import "./index.css";

export default function App() {
  const { user, setUser, currentMapId, maps, setMaps, pendingInvite, setPendingInvite, redeemInvite } = useGigaStore();

  // Load saved theme on mount + check for invite token in URL
  useEffect(() => {
    applyTheme(getSavedTheme());

    // Check URL for invite token
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken) {
      setPendingInvite(inviteToken);
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

  // Maps listener — query maps where user is a member (or owner via legacy ownerId)
  useEffect(() => {
    if (!user) return;

    // Query maps where user is in memberUids array
    const memberQuery = query(
      collection(db, "maps"),
      where("memberUids", "array-contains", user.uid)
    );

    // Also listen for legacy maps (ownerId only, no members field yet)
    const legacyQuery = query(
      collection(db, "maps"),
      where("ownerId", "==", user.uid)
    );

    const mapById = new Map();

    const updateMaps = () => {
      const allMaps = Array.from(mapById.values())
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setMaps(allMaps);
    };

    const unsubMember = onSnapshot(memberQuery, (snap) => {
      snap.docs.forEach((d) => {
        mapById.set(d.id, { id: d.id, ...d.data() });
      });
      // Remove maps that were removed from member query
      snap.docChanges().forEach((change) => {
        if (change.type === "removed") {
          mapById.delete(change.doc.id);
        }
      });
      updateMaps();
    });

    const unsubLegacy = onSnapshot(legacyQuery, (snap) => {
      snap.docs.forEach((d) => {
        // Only add if not already tracked by member query
        if (!mapById.has(d.id)) {
          mapById.set(d.id, { id: d.id, ...d.data() });
        }
      });
      snap.docChanges().forEach((change) => {
        if (change.type === "removed" && !mapById.get(change.doc.id)?.memberUids) {
          mapById.delete(change.doc.id);
        }
      });
      updateMaps();
    });

    return () => {
      unsubMember();
      unsubLegacy();
    };
  }, [user]);

  // Redeem pending invite after login
  useEffect(() => {
    if (user && pendingInvite) {
      redeemInvite(pendingInvite).then((success) => {
        if (!success) {
          console.warn("Failed to redeem invite");
          setPendingInvite(null);
        }
      });
    }
  }, [user, pendingInvite]);

  if (!user) return <AuthPage />;
  if (currentMapId) return <MapEditor />;
  return <Dashboard />;
}
