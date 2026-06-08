import { create } from "zustand";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const useGigaStore = create((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Current map
  currentMapId: null,
  setCurrentMapId: (id) => set({ currentMapId: id }),

  // User role for current map
  userRole: null, // 'owner' | 'editor' | 'viewer' | null
  currentMapData: null, // full map document data

  // Maps list
  maps: [],
  setMaps: (maps) => set({ maps }),

  // Nodes
  nodes: [],
  setNodes: (nodes) => set({ nodes }),

  // Connections
  connections: [],
  setConnections: (connections) => set({ connections }),

  // Presence & Chat
  onlineUsers: [],
  chatMessages: [],
  unsubscribePresence: null,
  unsubscribeChat: null,
  heartbeatInterval: null,

  sendChatMessage: async (text) => {
    const { user, currentMapId } = get();
    if (!user || !currentMapId || !text.trim()) return;
    await addDoc(collection(db, "maps", currentMapId, "chat"), {
      text: text.trim(),
      userId: user.uid,
      displayName: user.displayName || user.email || "",
      createdAt: serverTimestamp(),
    });
  },

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

  // --- Member management ---
  addMember: async (mapId, uid, role, email, displayName) => {
    const ref = doc(db, "maps", mapId);
    await updateDoc(ref, {
      [`members.${uid}`]: { role, email, displayName },
      memberUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  },

  removeMember: async (mapId, uid) => {
    const { currentMapData } = get();
    if (!currentMapData?.members) return;
    // Build new members without the removed uid
    const newMembers = { ...currentMapData.members };
    delete newMembers[uid];
    const ref = doc(db, "maps", mapId);
    await updateDoc(ref, {
      members: newMembers,
      memberUids: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
  },

  updateMemberRole: async (mapId, uid, newRole) => {
    const ref = doc(db, "maps", mapId);
    await updateDoc(ref, {
      [`members.${uid}.role`]: newRole,
      updatedAt: serverTimestamp(),
    });
  },

  transferOwnership: async (mapId, newOwnerUid) => {
    const { user, currentMapData } = get();
    if (!user || !currentMapData) return;
    const ref = doc(db, "maps", mapId);
    await updateDoc(ref, {
      ownerId: newOwnerUid,
      [`members.${newOwnerUid}.role`]: "owner",
      [`members.${user.uid}.role`]: "editor",
      updatedAt: serverTimestamp(),
    });
  },

  leaveMap: async (mapId) => {
    const { user } = get();
    if (!user) return;
    // Use get to get fresh currentMapData
    const store = get();
    const mapData = store.currentMapData;
    if (!mapData?.members) return;
    const newMembers = { ...mapData.members };
    delete newMembers[user.uid];
    const ref = doc(db, "maps", mapId);
    await updateDoc(ref, {
      members: newMembers,
      memberUids: arrayRemove(user.uid),
      updatedAt: serverTimestamp(),
    });
    // Go back to dashboard
    set({ currentMapId: null, currentMapData: null, userRole: null });
  },

  // Search users by email
  searchUsers: async (emailQuery) => {
    if (!emailQuery || emailQuery.length < 3) return [];
    const ref = collection(db, "users");
    const q = query(ref, where("email", "==", emailQuery.toLowerCase()));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // --- Realtime listeners ---
  unsubscribeNodes: null,
  unsubscribeConnections: null,
  unsubscribeIdeas: null,
  unsubscribeMapDoc: null,

  subscribeToMap: (mapId) => {
    const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas, unsubscribeMapDoc, user } = get();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeConnections) unsubscribeConnections();
    if (unsubscribeIdeas) unsubscribeIdeas();
    if (unsubscribeMapDoc) unsubscribeMapDoc();

    // Listen to the map document for membership/role changes
    const unsubMap = onSnapshot(
      doc(db, "maps", mapId),
      async (snap) => {
        if (!snap.exists()) {
          // Map was deleted or user lost access
          set({ currentMapId: null, currentMapData: null, userRole: null });
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        let role = data.members?.[user?.uid]?.role || (data.ownerId === user?.uid ? "owner" : null);

        // Auto-repair: if user is ownerId but members says something else, fix it
        if (data.ownerId === user?.uid && role !== "owner") {
          try {
            const { addMember } = get();
            await addMember(mapId, user.uid, "owner", (user.email || "").toLowerCase(), user.displayName || user.email || "");
            role = "owner";
          } catch (e) { /* ignore */ }
        }

        set({ currentMapData: data, userRole: role });
      }
    );

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

    // Subscribe to presence
    const presenceRef = collection(db, "maps", mapId, "presence");
    const unsubPresence = onSnapshot(presenceRef, (snap) => {
      const now = Date.now();
      const online = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.lastSeen && (now - u.lastSeen.toMillis()) < 90000);
      // Only update state if the online users list actually changed
      const prev = get().onlineUsers;
      const prevUids = prev.map((u) => u.uid).sort().join(",");
      const newUids = online.map((u) => u.uid).sort().join(",");
      if (prevUids !== newUids) {
        set({ onlineUsers: online });
      }
    });

    // Subscribe to chat (last 100 messages)
    const chatQuery = query(
      collection(db, "maps", mapId, "chat"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    const unsubChat = onSnapshot(chatQuery, (snap) => {
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      set({ chatMessages: messages });
    });

    // Start presence heartbeat
    const writePresence = async () => {
      if (!user) return;
      try {
        await setDoc(doc(db, "maps", mapId, "presence", user.uid), {
          displayName: user.displayName || user.email || "",
          photoURL: user.photoURL || "",
          email: (user.email || "").toLowerCase(),
          lastSeen: serverTimestamp(),
        });
      } catch (e) { /* ignore */ }
    };
    writePresence();
    const heartbeatInterval = setInterval(writePresence, 30000);

    set({
      currentMapId: mapId,
      unsubscribeNodes: unsubNodes,
      unsubscribeConnections: unsubConns,
      unsubscribeIdeas: unsubIdeas,
      unsubscribeMapDoc: unsubMap,
      unsubscribePresence: unsubPresence,
      unsubscribeChat: unsubChat,
      heartbeatInterval,
    });
  },

  unsubscribeAll: () => {
    const {
      unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas, unsubscribeMapDoc,
      unsubscribePresence, unsubscribeChat, heartbeatInterval, user, currentMapId,
    } = get();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeConnections) unsubscribeConnections();
    if (unsubscribeIdeas) unsubscribeIdeas();
    if (unsubscribeMapDoc) unsubscribeMapDoc();
    if (unsubscribePresence) unsubscribePresence();
    if (unsubscribeChat) unsubscribeChat();
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    // Remove presence on leave
    if (user && currentMapId) {
      deleteDoc(doc(db, "maps", currentMapId, "presence", user.uid)).catch(() => {});
    }
    set({
      onlineUsers: [], chatMessages: [],
      unsubscribePresence: null, unsubscribeChat: null, heartbeatInterval: null,
    });
  },

  // --- Invite links ---
  pendingInvite: null, // { mapId, role, token } — set before auth, redeemed after
  setPendingInvite: (invite) => set({ pendingInvite: invite }),

  createInvite: async (mapId, role) => {
    const { user } = get();
    if (!user) return null;
    const token = crypto.randomUUID();
    await addDoc(collection(db, "invites"), {
      token,
      mapId,
      role,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    return `${window.location.origin}${window.location.pathname}?invite=${token}`;
  },

  redeemInvite: async (token) => {
    const { user, addMember, subscribeToMap } = get();
    if (!user || !token) return false;
    // Look up invite
    const q = query(collection(db, "invites"), where("token", "==", token));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    const invite = snap.docs[0].data();

    // Check if user already has equal or higher role — don't downgrade
    const mapSnap = await getDocs(query(collection(db, "maps"), where("__name__", "==", invite.mapId)));
    if (!mapSnap.empty) {
      const mapDoc = mapSnap.docs[0].data();
      const currentRole = mapDoc.members?.[user.uid]?.role;
      const roleRank = { owner: 3, editor: 2, viewer: 1 };
      if (currentRole && (roleRank[currentRole] || 0) >= (roleRank[invite.role] || 0)) {
        // Already has equal or higher access — just navigate
        subscribeToMap(invite.mapId);
        set({ pendingInvite: null });
        window.history.replaceState({}, "", window.location.pathname);
        return true;
      }
    }

    // Add user as member
    await addMember(
      invite.mapId,
      user.uid,
      invite.role,
      (user.email || "").toLowerCase(),
      user.displayName || user.email || "",
    );
    // Navigate to the map
    subscribeToMap(invite.mapId);
    set({ pendingInvite: null });
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  },

  // History (undo/redo) - basic snapshot
  history: [],
  historyIndex: -1,
}));

export default useGigaStore;
