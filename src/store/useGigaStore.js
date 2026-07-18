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
  getDoc,
  arrayUnion,
  arrayRemove,
  orderBy,
  limit,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// Alle etterkommere av en node (hele undertreet), bredde-først.
// Nodene ligger flatt i maps/{id}/nodes og knyttes sammen med parentId.
export function descendantIds(nodes, rootId) {
  const byParent = new Map();
  nodes.forEach((n) => {
    const p = n.parentId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n.id);
  });
  const out = [];
  const queue = [rootId];
  // seen beskytter mot sykliske parentId-kjeder — uten den ville korrupt
  // data gitt en evig løkke som fryser hele fanen
  const seen = new Set([rootId]);
  while (queue.length) {
    const id = queue.shift();
    for (const childId of byParent.get(id) || []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      out.push(childId);
      queue.push(childId);
    }
  }
  return out;
}

// Stien fra toppnivået ned til et underkart, for brødsmuler
export function pageTrail(nodes, pageId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trail = [];
  let cur = pageId;
  const guard = new Set(); // beskytter mot sykliske parentId-kjeder
  while (cur && byId.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    trail.unshift(byId.get(cur));
    cur = byId.get(cur).parentId ?? null;
  }
  return trail;
}

// Innholdsendringer skal slå gjennom på kartets updatedAt, ellers viser
// dashbordet feil "Oppdatert"-dato og sorterer kartene feil. Debounces så
// det ikke blir én ekstra skriving per endring.
let touchTimer = null;
function touchMap(mapId) {
  if (!mapId) return;
  if (touchTimer) clearTimeout(touchTimer);
  touchTimer = setTimeout(() => {
    touchTimer = null;
    updateDoc(doc(db, "maps", mapId), { updatedAt: serverTimestamp() }).catch(
      () => {}
    );
  }, 2000);
}

// Tilstand som hører til ETT kart. Nullstilles ved kartbytte og utlogging,
// ellers vises forrige karts noder i det nye kartet — og redigering av dem
// skriver til feil dokumentsti.
const EMPTY_MAP_STATE = {
  nodes: [],
  connections: [],
  ideas: [],
  chatMessages: [],
  onlineUsers: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  connectingFrom: null,
  openModalNodeId: null,
  currentPageId: null,
  activeGesture: null,
  currentMapData: null,
  userRole: null,
};

// Oversett Firestore-feil til noe en bruker forstår
function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied"))
    return "Du har ikke tilgang til å endre dette kartet.";
  if (code.includes("unavailable") || code.includes("network"))
    return "Ingen forbindelse — endringen ble ikke lagret.";
  if (code.includes("not-found"))
    return "Elementet finnes ikke lenger.";
  if (code.includes("resource-exhausted"))
    return "Kvoten for databasen er brukt opp. Prøv igjen senere.";
  return err?.message || "Noe gikk galt under lagring.";
}

// Mutasjoner som skriver til Firestore. Uten feilhåndtering ble avviste
// skrivinger stille forkastet mens UI-et så lagret ut, fordi Firestores
// latency compensation viser endringen lokalt med én gang.
const GUARDED_ACTIONS = [
  "addNode", "updateNode", "deleteNode",
  "addConnection", "updateConnection", "deleteConnection",
  "addIdea", "deleteIdea", "promoteIdea",
  "makePage", "unmakePage",
  "sendChatMessage", "deleteMap",
];

// Endringer som skal telle som "kartet ble oppdatert". Chat og sletting
// av selve kartet holdes utenfor — det første er ikke innhold, det andre
// ville skrevet til et dokument som nettopp forsvant.
const TOUCHING_ACTIONS = new Set(
  GUARDED_ACTIONS.filter((n) => n !== "sendChatMessage" && n !== "deleteMap")
);

const withErrorHandling = (config) => (set, get, api) => {
  const store = config(set, get, api);
  GUARDED_ACTIONS.forEach((name) => {
    const original = store[name];
    if (typeof original !== "function") return;
    store[name] = async (...args) => {
      try {
        const result = await original(...args);
        if (TOUCHING_ACTIONS.has(name)) touchMap(get().currentMapId);
        return result;
      } catch (err) {
        console.error(`${name} feilet:`, err);
        set({ syncError: friendlyError(err) });
      }
    };
  });
  return store;
};

const useGigaStore = create(withErrorHandling((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Feil fra skrivinger og lyttere. Uten dette forsvant feilede lagringer
  // stille mens UI-et så lagret ut — vises nå av <ErrorToast />.
  syncError: null,
  setSyncError: (syncError) => set({ syncError }),

  // Current map
  currentMapId: null,
  setCurrentMapId: (id) => set({ currentMapId: id }),

  // --- Underkart ---
  // Hvilket underkart man står i. null = kartets toppnivå.
  // Noder og koblinger bærer parentId som peker på underkart-noden de bor i.
  currentPageId: null,
  setCurrentPageId: (id) => set({ currentPageId: id ?? null }),

  // Gå inn i et underkart: nullstill valg og viewport så man ikke
  // drar med seg markering eller panorering fra nivået over.
  enterPage: (nodeId) =>
    set({
      currentPageId: nodeId,
      selectedNodeId: null,
      selectedConnectionId: null,
      connectingFrom: null,
      openModalNodeId: null,
      pan: { x: 0, y: 0 },
      zoom: 1,
    }),

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

  // Tilpass innholdet på gjeldende nivå til viewporten. Pan regnes med
  // den CLAMPEDE zoomen — ellers spriker zoom og pan for store kart, og
  // resultatet blir et tomt lerret.
  fitToScreen: (viewport) => {
    const { nodes, currentPageId } = get();
    if (!viewport) return;
    const level = nodes.filter(
      (n) => (n.parentId ?? null) === (currentPageId ?? null)
    );
    if (level.length === 0) {
      set({ zoom: 1, pan: { x: 0, y: 0 } });
      return;
    }
    const minX = Math.min(...level.map((n) => n.x));
    const minY = Math.min(...level.map((n) => n.y));
    const maxX = Math.max(...level.map((n) => n.x + n.w));
    const maxY = Math.max(...level.map((n) => n.y + n.h));
    const PAD = 80;
    const zoom = Math.min(
      1.5,
      Math.max(
        0.1,
        Math.min(
          viewport.width / (maxX - minX + PAD),
          viewport.height / (maxY - minY + PAD)
        )
      )
    );
    set({
      zoom,
      pan: {
        x: viewport.width / 2 - ((minX + maxX) / 2) * zoom,
        y: viewport.height / 2 - ((minY + maxY) / 2) * zoom,
      },
    });
  },

  // --- Node actions ---
  addNode: async (nodeData) => {
    const { currentMapId, currentPageId } = get();
    if (!currentMapId) return;
    const ref = collection(db, "maps", currentMapId, "nodes");
    await addDoc(ref, {
      // Noden fødes på nivået man står i
      parentId: currentPageId ?? null,
      ...nodeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  // Gjør en node om til et underkart (eksplisitt valg — vanlige noder
  // kan ikke åpnes). Innholdet opprettes først når man legger noe der.
  makePage: async (nodeId) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    await updateDoc(doc(db, "maps", currentMapId, "nodes", nodeId), {
      isPage: true,
      updatedAt: serverTimestamp(),
    });
  },

  // Fjern underkart-status. Nekter hvis underkartet har innhold, slik at
  // man ikke gjør innhold uneåbart ved et uhell.
  unmakePage: async (nodeId) => {
    const { currentMapId, nodes, currentPageId } = get();
    if (!currentMapId) return false;
    const hasChildren = nodes.some((n) => (n.parentId ?? null) === nodeId);
    if (hasChildren) return false;
    await updateDoc(doc(db, "maps", currentMapId, "nodes", nodeId), {
      isPage: false,
      updatedAt: serverTimestamp(),
    });
    if (currentPageId === nodeId) set({ currentPageId: null });
    return true;
  },

  // Geometrien til noden som dras/skaleres akkurat nå. Snapshots fra
  // Firestore (f.eks. når en kollega redigerer samtidig) skal ikke
  // overstyre en pågående gest — da ville noden hoppet tilbake i hånda.
  activeGesture: null, // { nodeId, patch }
  endGesture: () => set({ activeGesture: null }),

  // Ren lokal flytting/skalering — brukes under drag og resize så noden
  // følger musa uten å skrive til Firestore på hver eneste mousemove.
  // Selve lagringen skjer én gang, på mouseup, via updateNode.
  patchNodeLocal: (nodeId, updates) => {
    const prev = get().activeGesture;
    const patch =
      prev?.nodeId === nodeId ? { ...prev.patch, ...updates } : { ...updates };
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
      activeGesture: { nodeId, patch },
    });
  },

  updateNode: async (nodeId, updates) => {
    const { currentMapId } = get();
    if (!currentMapId) return;
    const ref = doc(db, "maps", currentMapId, "nodes", nodeId);
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  },

  // Sletter noden OG hele underkartet under den (alle nivåer), pluss
  // koblinger som rører noen av dem. Alt går i batch så man ikke kan
  // ende opp med foreldreløst innhold hvis noe avbrytes underveis.
  deleteNode: async (nodeId) => {
    const { currentMapId, nodes, connections, currentPageId } = get();
    if (!currentMapId) return;

    const doomed = [nodeId, ...descendantIds(nodes, nodeId)];
    const doomedSet = new Set(doomed);
    const doomedConns = connections.filter(
      (c) =>
        doomedSet.has(c.fromNode) ||
        doomedSet.has(c.toNode) ||
        doomedSet.has(c.parentId ?? null)
    );

    const refs = [
      ...doomed.map((id) => doc(db, "maps", currentMapId, "nodes", id)),
      ...doomedConns.map((c) => doc(db, "maps", currentMapId, "connections", c.id)),
    ];

    // Batch-grensen er 500 operasjoner
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }

    // Sto man inne i noe som nettopp ble slettet, må man ut
    if (currentPageId && doomedSet.has(currentPageId)) {
      const deletedRoot = nodes.find((n) => n.id === nodeId);
      set({ currentPageId: deletedRoot?.parentId ?? null });
    }
  },

  // Hvor mange elementer ligger under en node (hele undertreet)?
  // Brukes til å advare før sletting og til telleren på noden.
  descendantCount: (nodeId) => descendantIds(get().nodes, nodeId).length,

  // --- Connection actions ---
  addConnection: async (connData) => {
    const { currentMapId, currentPageId } = get();
    if (!currentMapId) return;
    const ref = collection(db, "maps", currentMapId, "connections");
    await addDoc(ref, {
      // Koblingen lever på samme nivå som nodene den binder sammen
      parentId: currentPageId ?? null,
      ...connData,
      createdAt: serverTimestamp(),
    });
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
    const { currentMapId, currentPageId, ideas } = get();
    if (!currentMapId) return;
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    // Create a real node from the idea, på nivået man står i
    await addDoc(collection(db, "maps", currentMapId, "nodes"), {
      parentId: currentPageId ?? null,
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

  subscribeToMap: async (mapId) => {
    const { unsubscribeNodes, unsubscribeConnections, unsubscribeIdeas, unsubscribeMapDoc, user } = get();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeConnections) unsubscribeConnections();
    if (unsubscribeIdeas) unsubscribeIdeas();
    if (unsubscribeMapDoc) unsubscribeMapDoc();

    // Pre-flight: migrate legacy maps before setting up listeners
    // This ensures memberUids exists so Firestore rules don't block subcollections
    try {
      const mapSnap = await getDoc(doc(db, "maps", mapId));
      if (mapSnap.exists()) {
        const data = mapSnap.data();
        const needsMigration = data.ownerId === user?.uid && 
          (!data.memberUids || !data.memberUids.includes(user.uid));
        if (needsMigration) {
          const { addMember } = get();
          await addMember(mapId, user.uid, "owner", (user.email || "").toLowerCase(), user.displayName || user.email || "");
        }
      }
    } catch { /* ignore migration errors */ }

    // Listen to the map document for membership/role changes
    const unsubMap = onSnapshot(
      doc(db, "maps", mapId),
      async (snap) => {
        if (!snap.exists()) {
          // Map was deleted or user lost access
          set({ currentMapId: null, currentPageId: null, currentMapData: null, userRole: null });
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
          } catch { /* ignore */ }
        }

        set({ currentMapData: data, userRole: role });
      }
    );

    // En lytter som feiler blir terminert permanent av SDK-en. Uten
    // error-callback fryser lerretet stille på siste kjente data mens
    // brukeren tror han fortsatt er koblet til.
    const onListenerError = (what) => (err) => {
      console.error(`Lytter for ${what} feilet:`, err);
      set({ syncError: `Mistet forbindelsen til ${what}. Last siden på nytt.` });
    };

    const unsubNodes = onSnapshot(
      collection(db, "maps", mapId, "nodes"),
      (snap) => {
        const incoming = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Behold posisjonen til noden som dras akkurat nå, ellers rykker
        // den tilbake hver gang en annen bruker endrer noe i kartet
        const gesture = get().activeGesture;
        set({
          nodes: gesture
            ? incoming.map((n) =>
                n.id === gesture.nodeId ? { ...n, ...gesture.patch } : n
              )
            : incoming,
        });
      },
      onListenerError("nodene")
    );

    const unsubConns = onSnapshot(
      collection(db, "maps", mapId, "connections"),
      (snap) => {
        const connections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ connections });
      },
      onListenerError("koblingene")
    );

    const unsubIdeas = onSnapshot(
      collection(db, "maps", mapId, "ideas"),
      (snap) => {
        const ideas = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        set({ ideas });
      },
      onListenerError("ideene")
    );

    // Subscribe to presence
    const presenceRef = collection(db, "maps", mapId, "presence");
    const unsubPresence = onSnapshot(presenceRef, (snap) => {
      const now = Date.now();
      const online = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => {
          // Always include current user (they're obviously online)
          if (u.uid === user?.uid) return true;
          // For others, check lastSeen within 90 seconds
          if (!u.lastSeen || typeof u.lastSeen.toMillis !== "function") return false;
          return (now - u.lastSeen.toMillis()) < 90000;
        });
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
      } catch { /* ignore */ }
    };
    writePresence();
    const heartbeatInterval = setInterval(writePresence, 30000);

    set({
      // Rydd forrige karts innhold FØR de nye snapshotene kommer, ellers
      // rendres kart A inne i kart B mens man venter på nettverket
      ...EMPTY_MAP_STATE,
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
      unsubscribeNodes: null, unsubscribeConnections: null,
      unsubscribeIdeas: null, unsubscribeMapDoc: null,
      unsubscribePresence: null, unsubscribeChat: null, heartbeatInterval: null,
    });
  },

  // Lukk kartet og rydd alt kartinnhold (tilbake til dashbordet)
  closeMap: () => {
    get().unsubscribeAll();
    set({ ...EMPTY_MAP_STATE, currentMapId: null });
  },

  // Full nullstilling ved utlogging. Uten denne overlevde både åpent kart
  // og levende lyttere, så neste konto som logget inn på samme maskin
  // landet rett i forrige brukers kart.
  resetSession: () => {
    get().unsubscribeAll();
    set({
      ...EMPTY_MAP_STATE,
      currentMapId: null,
      maps: [],
      syncError: null,
    });
  },

  // Firestore kaskade-sletter aldri subkolleksjoner. Uten dette ble alle
  // noder, koblinger, ideer og chat liggende igjen for alltid.
  deleteMap: async (mapId) => {
    const refs = [];
    for (const sub of ["nodes", "connections", "ideas", "chat", "presence"]) {
      try {
        const snap = await getDocs(collection(db, "maps", mapId, sub));
        snap.docs.forEach((d) => refs.push(d.ref));
      } catch {
        // Mangler tilgang til en subkolleksjon — hopp over den
      }
    }
    // Kart-dokumentet slettes SIST, slik at reglenes eierskapssjekk
    // (get på parent) fortsatt holder mens subkolleksjonene ryddes
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
    await deleteDoc(doc(db, "maps", mapId));
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
})));

export default useGigaStore;
