import { create } from "zustand";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const useGigaStore = create((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Current map
  currentMapId: null,
  setCurrentMapId: (id) => set({ currentMapId: id }),

  // Maps list
  maps: [],
  setMaps: (maps) => set({ maps }),

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
    const raw = typeof zoomOrFn === 'function' ? zoomOrFn(prev) : zoomOrFn;
    set({ zoom: Math.min(3, Math.max(0.1, raw)) });
  },

  pan: { x: 0, y: 0 },
  setPan: (panOrFn) => {
    const prev = get().pan;
    const raw = typeof panOrFn === 'function' ? panOrFn(prev) : panOrFn;
    set({ pan: raw });
  },

  // --- Node actions ---
  addNode: async (nodeData) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    const ref = collection(db, "maps", currentMapId, "nodes");
    await addDoc(ref, {
      ...nodeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  updateNode: async (nodeId, updates) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    const ref = doc(db, "maps", currentMapId, "nodes", nodeId);
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  },

  deleteNode: async (nodeId) => {
    const { currentMapId, connections } = get();
    if (!currentMapId) return;
    await deleteDoc(doc(db, "maps", currentMapId, "nodes", nodeId));
    // Also delete connections referencing this node
    const relatedConns = connections.filter(
      (c) => c.fromNode === nodeId || c.toNode === nodeId
    );
    for (const c of relatedConns) {
      await deleteDoc(doc(db, "maps", currentMapId, "connections", c.id));
    }
  },

  // --- Connection actions ---
  addConnection: async (connData) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    const ref = collection(db, "maps", currentMapId, "connections");
    await addDoc(ref, { ...connData, createdAt: serverTimestamp() });
  },

  updateConnection: async (connId, updates) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    const ref = doc(db, "maps", currentMapId, "connections", connId);
    await updateDoc(ref, updates);
  },

  deleteConnection: async (connId) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    await deleteDoc(doc(db, "maps", currentMapId, "connections", connId));
  },

  // Ideas (brainstorm panel)
  ideas: [],
  setIdeas: (ideas) => set({ ideas }),

  addIdea: async (text) => {
    const { currentMapId } = get();
    if (!currentMapId || !text.trim()) return;
    await addDoc(collection(db, "maps", currentMapId, "ideas"), {
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  },

  deleteIdea: async (ideaId) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    await deleteDoc(doc(db, "maps", currentMapId, "ideas", ideaId));
  },

  promoteIdea: async (ideaId, x, y) => {
    const { currentMapId, ideas } = get();
    if (!currentMapId) return;
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    // Create a real node from the idea
    await addDoc(collection(db, "maps", currentMapId, "nodes"), {
      x, y, w: 220, h: 110,
      title: idea.text,
      notes: "",
      color: "",
      type: "Generell",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Remove the idea
    await deleteDoc(doc(db, "maps", currentMapId, "ideas", ideaId));
  },

  // --- Realtime listeners ---
  unsubscribeNodes: null,
  unsubscribeConnections: null,
  unsubscribeIdeas: null,

  subscribeToMap: (mapId) => {
    const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas } = get();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeConnections) unsubscribeConnections();
    if (unsubscribeIdeas) unsubscribeIdeas();

    const unsubNodes = onSnapshot(
      collection(db, "maps", mapId, "nodes"),
      (snap) => {
        const nodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ nodes });
      }
    );

    const unsubConns = onSnapshot(
      collection(db, "maps", mapId, "connections"),
      (snap) => {
        const connections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ connections });
      }
    );

    const unsubIdeas = onSnapshot(
      collection(db, "maps", mapId, "ideas"),
      (snap) => {
        const ideas = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        set({ ideas });
      }
    );

    set({
      currentMapId: mapId,
      unsubscribeNodes: unsubNodes,
      unsubscribeConnections: unsubConns,
      unsubscribeIdeas: unsubIdeas,
    });
  },

  unsubscribeAll: () => {
    const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas } = get();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeConnections) unsubscribeConnections();
    if (unsubscribeIdeas) unsubscribeIdeas();
  },

  // History (undo/redo) - basic snapshot
  history: [],
  historyIndex: -1,
}));

export default useGigaStore;
