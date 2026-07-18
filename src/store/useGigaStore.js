import { create } from "zustand";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Debounced bump av kartets updatedAt, så Dashboard-sortering og
// "Oppdatert"-dato følger reelle innholdsendringer uten én ekstra
// skriving per museflytt/tastetrykk.
let touchTimer = null;
let touchMapId = null;
function touchMap(mapId) {
  if (!mapId) return;
  if (touchTimer && touchMapId === mapId) clearTimeout(touchTimer);
  touchMapId = mapId;
  touchTimer = setTimeout(() => {
    touchTimer = null;
    updateDoc(doc(db, "maps", mapId), { updatedAt: serverTimestamp() }).catch(
      () => {}
    );
  }, 2000);
}

const EMPTY_MAP_STATE = {
  nodes: [],
  connections: [],
  ideas: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  connectingFrom: null,
  openModalNodeId: null,
};

const useGigaStore = create((set, get) => {
  // Alle Firestore-mutasjoner går gjennom run(): feil logges og vises
  // som toast i stedet for å forsvinne som unhandled rejections.
  const run = async (fn, opts = {}) => {
    try {
      await fn();
    } catch (err) {
      // not-found = dokumentet ble slettet i mellomtiden (f.eks. ulagret
      // kladd flushes idet noden slettes) — endringen er uansett irrelevant
      if (err?.code === "not-found") {
        console.warn("Firestore: dokumentet finnes ikke lenger, hopper over:", err);
        return;
      }
      // permission-denied er godartet når skrivingen skjer etter utlogging,
      // eller mot et kart som nettopp ble slettet (reglenes get() på
      // manglende parent avvises som permission, ikke not-found) — ikke
      // vis rå Firestore-feil for en skriving som uansett er irrelevant
      if (err?.code === "permission-denied") {
        const { user, maps, mapsLoaded } = get();
        const mapGone =
          opts.mapId && mapsLoaded && !maps.some((m) => m.id === opts.mapId);
        if (!user || mapGone) {
          console.warn("Firestore: godartet avvist skriving, hopper over:", err);
          return;
        }
      }
      console.error("Firestore-operasjon feilet:", err);
      set({ syncError: err?.message || "Ukjent feil ved lagring" });
    }
  };

  return {
    // Auth
    user: null,
    setUser: (user) => set({ user }),

    // Feil fra skrivinger/lyttere — vises av <ErrorToast />
    syncError: null,
    setSyncError: (syncError) => set({ syncError }),

    // Current map
    currentMapId: null,
    setCurrentMapId: (id) => set({ currentMapId: id }),

    // Maps list
    maps: [],
    mapsLoaded: false,
    setMaps: (maps) => set({ maps, mapsLoaded: true }),

    // Nodes
    nodes: [],
    setNodes: (nodes) => set({ nodes }),

    // Connections
    connections: [],
    setConnections: (connections) => set({ connections }),

    // UI State
    selectedNodeId: null,
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    selectedConnectionId: null,
    setSelectedConnectionId: (id) => set({ selectedConnectionId: id }),

    connectingFrom: null,
    setConnectingFrom: (nodeId) => set({ connectingFrom: nodeId }),

    openModalNodeId: null,
    setOpenModalNodeId: (id) => set({ openModalNodeId: id }),

    zoom: 1,
    setZoom: (zoomOrFn) => {
      const prev = get().zoom;
      const raw = typeof zoomOrFn === "function" ? zoomOrFn(prev) : zoomOrFn;
      set({ zoom: Math.min(3, Math.max(0.1, raw)) });
    },

    pan: { x: 0, y: 0 },
    setPan: (panOrFn) => {
      const prev = get().pan;
      const raw = typeof panOrFn === "function" ? panOrFn(prev) : panOrFn;
      set({ pan: raw });
    },

    // Tilpass innholdet til viewporten. Pan regnes med den CLAMPEDE
    // zoomen, ellers spriker zoom og pan for store kart.
    fitToScreen: (viewport) => {
      const { nodes } = get();
      if (!viewport) return;
      if (nodes.length === 0) {
        set({ zoom: 1, pan: { x: 0, y: 0 } });
        return;
      }
      const minX = Math.min(...nodes.map((n) => n.x));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxX = Math.max(...nodes.map((n) => n.x + n.w));
      const maxY = Math.max(...nodes.map((n) => n.y + n.h));
      const PAD = 80;
      const rawZoom = Math.min(
        viewport.width / (maxX - minX + PAD),
        viewport.height / (maxY - minY + PAD)
      );
      const zoom = Math.min(1.5, Math.max(0.1, rawZoom));
      set({
        zoom,
        pan: {
          x: viewport.width / 2 - ((minX + maxX) / 2) * zoom,
          y: viewport.height / 2 - ((minY + maxY) / 2) * zoom,
        },
      });
    },

    // --- Node actions ---
    // Ren lokal oppdatering (drag/resize følger musa uten nettverkstrafikk);
    // commit til Firestore skjer på mouseup via updateNode.
    patchNodeLocal: (nodeId, updates) =>
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updates } : n
        ),
      }),

    addNode: (nodeData) =>
      run(async () => {
        const { currentMapId } = get();
        if (!currentMapId) return;
        const ref = collection(db, "maps", currentMapId, "nodes");
        await addDoc(ref, {
          ...nodeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        touchMap(currentMapId);
      }),

    // mapId kan gis eksplisitt: debounced/unmount-committede kladder må
    // treffe kartet de ble skrevet i, selv om brukeren har byttet/lukket
    // kart før commiten fyrer (ellers droppes eller feiladresseres de).
    updateNode: (nodeId, updates, mapId) => {
      const targetMapId = mapId || get().currentMapId;
      if (!targetMapId) return Promise.resolve();
      return run(
        async () => {
          const ref = doc(db, "maps", targetMapId, "nodes", nodeId);
          await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
          touchMap(targetMapId);
        },
        { mapId: targetMapId }
      );
    },

    // Node + tilhørende koblinger slettes atomisk i én batch.
    deleteNode: (nodeId) =>
      run(async () => {
        const { currentMapId, connections } = get();
        if (!currentMapId) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, "maps", currentMapId, "nodes", nodeId));
        connections
          .filter((c) => c.fromNode === nodeId || c.toNode === nodeId)
          .forEach((c) =>
            batch.delete(doc(db, "maps", currentMapId, "connections", c.id))
          );
        await batch.commit();
        touchMap(currentMapId);
      }),

    // --- Connection actions ---
    addConnection: (connData) =>
      run(async () => {
        const { currentMapId } = get();
        if (!currentMapId) return;
        const ref = collection(db, "maps", currentMapId, "connections");
        await addDoc(ref, { ...connData, createdAt: serverTimestamp() });
        touchMap(currentMapId);
      }),

    updateConnection: (connId, updates, mapId) => {
      const targetMapId = mapId || get().currentMapId;
      if (!targetMapId) return Promise.resolve();
      return run(
        async () => {
          const ref = doc(db, "maps", targetMapId, "connections", connId);
          await updateDoc(ref, updates);
          touchMap(targetMapId);
        },
        { mapId: targetMapId }
      );
    },

    deleteConnection: (connId) =>
      run(async () => {
        const { currentMapId } = get();
        if (!currentMapId) return;
        await deleteDoc(doc(db, "maps", currentMapId, "connections", connId));
        touchMap(currentMapId);
      }),

    // --- Map actions ---
    renameMap: (mapId, title) =>
      run(
        async () => {
          await updateDoc(doc(db, "maps", mapId), {
            title,
            updatedAt: serverTimestamp(),
          });
        },
        { mapId }
      ),

    // Firestore kaskade-sletter aldri subkolleksjoner, så noder/koblinger/
    // ideer må slettes eksplisitt. Kart-dokumentet slettes SIST slik at
    // sikkerhetsreglenes eierskapssjekk (get på parent) holder underveis.
    deleteMap: (mapId) =>
      run(async () => {
        const refs = [];
        for (const sub of ["nodes", "connections", "ideas"]) {
          const snap = await getDocs(collection(db, "maps", mapId, sub));
          snap.docs.forEach((d) => refs.push(d.ref));
        }
        refs.push(doc(db, "maps", mapId));
        // Batch-grensen er 500 operasjoner
        for (let i = 0; i < refs.length; i += 450) {
          const batch = writeBatch(db);
          refs.slice(i, i + 450).forEach((r) => batch.delete(r));
          await batch.commit();
        }
      }),

    // Ideas (brainstorm panel)
    ideas: [],
    setIdeas: (ideas) => set({ ideas }),

    addIdea: (text) =>
      run(async () => {
        const { currentMapId } = get();
        if (!currentMapId || !text.trim()) return;
        await addDoc(collection(db, "maps", currentMapId, "ideas"), {
          text: text.trim(),
          createdAt: serverTimestamp(),
        });
        touchMap(currentMapId);
      }),

    deleteIdea: (ideaId) =>
      run(async () => {
        const { currentMapId } = get();
        if (!currentMapId) return;
        await deleteDoc(doc(db, "maps", currentMapId, "ideas", ideaId));
        touchMap(currentMapId);
      }),

    // Idé → node atomisk: enten skjer begge deler eller ingen.
    promoteIdea: (ideaId, x, y) =>
      run(async () => {
        const { currentMapId, ideas } = get();
        if (!currentMapId) return;
        const idea = ideas.find((i) => i.id === ideaId);
        if (!idea) return;
        const batch = writeBatch(db);
        const nodeRef = doc(collection(db, "maps", currentMapId, "nodes"));
        batch.set(nodeRef, {
          x,
          y,
          w: 220,
          h: 110,
          title: idea.text,
          notes: "",
          color: "",
          type: "Generell",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.delete(doc(db, "maps", currentMapId, "ideas", ideaId));
        await batch.commit();
        touchMap(currentMapId);
      }),

    // --- Realtime listeners ---
    unsubscribeNodes: null,
    unsubscribeConnections: null,
    unsubscribeIdeas: null,

    subscribeToMap: (mapId) => {
      const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas } =
        get();
      if (unsubscribeNodes) unsubscribeNodes();
      if (unsubscribeConnections) unsubscribeConnections();
      if (unsubscribeIdeas) unsubscribeIdeas();

      const onError = (err) => {
        console.error("Firestore-lytter feilet:", err);
        set({ syncError: err?.message || "Mistet forbindelsen til kartet" });
      };

      const unsubNodes = onSnapshot(
        collection(db, "maps", mapId, "nodes"),
        (snap) => {
          const nodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          set({ nodes });
        },
        onError
      );

      const unsubConns = onSnapshot(
        collection(db, "maps", mapId, "connections"),
        (snap) => {
          const connections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          set({ connections });
        },
        onError
      );

      const unsubIdeas = onSnapshot(
        collection(db, "maps", mapId, "ideas"),
        (snap) => {
          const ideas = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort(
              (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
            );
          set({ ideas });
        },
        onError
      );

      // Nullstill forrige karts innhold FØR nye snapshots kommer, så kart A
      // aldri rendres (eller redigeres) inne i kart B.
      set({
        ...EMPTY_MAP_STATE,
        currentMapId: mapId,
        unsubscribeNodes: unsubNodes,
        unsubscribeConnections: unsubConns,
        unsubscribeIdeas: unsubIdeas,
      });
    },

    unsubscribeAll: () => {
      const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas } =
        get();
      if (unsubscribeNodes) unsubscribeNodes();
      if (unsubscribeConnections) unsubscribeConnections();
      if (unsubscribeIdeas) unsubscribeIdeas();
      set({
        unsubscribeNodes: null,
        unsubscribeConnections: null,
        unsubscribeIdeas: null,
      });
    },

    // Lukk kartet og rydd alt kartinnhold (tilbake til Dashboard).
    closeMap: () => {
      get().unsubscribeAll();
      set({ ...EMPTY_MAP_STATE, currentMapId: null });
    },

    // Full nullstilling ved utlogging — neste konto skal aldri se
    // forrige brukers kart eller arve levende lyttere.
    resetSession: () => {
      get().unsubscribeAll();
      set({
        ...EMPTY_MAP_STATE,
        currentMapId: null,
        maps: [],
        mapsLoaded: false,
        syncError: null,
      });
    },
  };
});

export default useGigaStore;
