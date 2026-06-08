import { useState, useEffect, useRef } from "react";
import useGigaStore from "../store/useGigaStore";

const ROLE_LABELS = {
  owner: "Eier",
  editor: "Les og skriv",
  viewer: "Kun les",
};

export default function ShareModal({ mapId, onClose }) {
  const {
    user, currentMapData, maps,
    addMember, removeMember, updateMemberRole, transferOwnership, searchUsers,
  } = useGigaStore();

  // Use currentMapData if it matches, otherwise find from maps list
  const mapData = currentMapData?.id === mapId
    ? currentMapData
    : maps.find((m) => m.id === mapId);

  const members = mapData?.members || {};
  const isOwner = members[user?.uid]?.role === "owner" || mapData?.ownerId === user?.uid;

  const [emailInput, setEmailInput] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const searchTimeout = useRef(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearchResults([]);
    setError("");

    if (emailInput.length < 3) return;

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(emailInput.trim().toLowerCase());
        // Filter out users already in the map
        const filtered = results.filter((u) => !members[u.id]);
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search failed:", err);
      }
      setSearching(false);
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [emailInput]);

  const handleAddUser = async (foundUser) => {
    setError("");
    setSuccess("");
    try {
      await addMember(
        mapId,
        foundUser.id,
        selectedRole,
        foundUser.email,
        foundUser.displayName || foundUser.email,
      );
      setSuccess(`${foundUser.displayName || foundUser.email} lagt til som ${ROLE_LABELS[selectedRole]}`);
      setEmailInput("");
      setSearchResults([]);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Add member failed:", err);
      setError(`Kunne ikke legge til: ${err.message}`);
    }
  };

  const handleAddByEmail = async () => {
    if (!emailInput.trim()) return;
    setError("");
    setSearching(true);
    try {
      const results = await searchUsers(emailInput.trim().toLowerCase());
      if (results.length === 0) {
        setError("Fant ingen bruker med denne e-postadressen. Brukeren må ha logget inn i appen minst én gang.");
      } else {
        const foundUser = results[0];
        if (members[foundUser.id]) {
          setError("Denne brukeren er allerede lagt til.");
        } else {
          await handleAddUser(foundUser);
        }
      }
    } catch (err) {
      setError(`Feil: ${err.message}`);
    }
    setSearching(false);
  };

  const handleRoleChange = async (uid, newRole) => {
    if (newRole === "owner") {
      if (window.confirm("Overføre eierskap? Du vil bli satt som \"Les og skriv\".")) {
        await transferOwnership(mapId, uid);
      }
    } else {
      await updateMemberRole(mapId, uid, newRole);
    }
  };

  const handleRemove = async (uid, name) => {
    if (window.confirm(`Fjerne ${name} fra dette kartet?`)) {
      await removeMember(mapId, uid);
    }
  };

  const memberEntries = Object.entries(members).sort((a, b) => {
    const order = { owner: 0, editor: 1, viewer: 2 };
    return (order[a[1].role] || 3) - (order[b[1].role] || 3);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-card share-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span style={{ fontSize: 20 }}>🔗</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>Del kart</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Lukk">✕</button>
        </div>

        <div className="modal-body">
          {/* Search & Add */}
          {isOwner && (
            <div className="modal-section">
              <label>Legg til bruker</label>
              <div className="share-search-row">
                <input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddByEmail(); }}
                  placeholder="Skriv e-postadresse..."
                />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="editor">Les og skriv</option>
                  <option value="viewer">Kun les</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={handleAddByEmail}
                  disabled={searching || !emailInput.trim()}
                >
                  {searching ? "..." : "Legg til"}
                </button>
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="share-search-result"
                      onClick={() => handleAddUser(u)}
                    >
                      {u.photoURL && (
                        <img
                          src={u.photoURL}
                          alt=""
                          style={{ width: 24, height: 24, borderRadius: "50%", marginRight: 8 }}
                        />
                      )}
                      <span style={{ flex: 1 }}>
                        <strong>{u.displayName || u.email}</strong>
                        {u.displayName && (
                          <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 12 }}>{u.email}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(239,68,68,0.12)", color: "#f87171", fontSize: 12,
                }}>
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 12,
                }}>
                  ✅ {success}
                </div>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="modal-section">
            <label>👥 Medlemmer ({memberEntries.length})</label>
            <div className="member-list">
              {memberEntries.map(([uid, member]) => {
                const isMe = uid === user?.uid;
                const isMemberOwner = member.role === "owner";

                return (
                  <div key={uid} className={`member-row${isMemberOwner ? " is-owner" : ""}`}>
                    <div className="member-avatar-placeholder">
                      {(member.displayName || member.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <span className="member-name">
                        {member.displayName || member.email}
                        {isMe && " (deg)"}
                      </span>
                      <span className="member-email">{member.email}</span>
                    </div>

                    {isOwner && !isMe ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(uid, e.target.value)}
                        >
                          <option value="editor">Les og skriv</option>
                          <option value="viewer">Kun les</option>
                          <option value="owner">Eier</option>
                        </select>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleRemove(uid, member.displayName || member.email)}
                          title="Fjern"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className={`role-badge ${member.role}`}>
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div />
          <button className="btn btn-ghost" onClick={onClose}>Lukk</button>
        </div>
      </div>
    </div>
  );
}
