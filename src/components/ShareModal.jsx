import { useState, useEffect } from "react";
import useGigaStore from "../store/useGigaStore";

const ROLE_LABELS = {
  owner: "Eier",
  editor: "Les og skriv",
  viewer: "Kun les",
};

export default function ShareModal({ mapId, onClose }) {
  const {
    user, currentMapData, maps,
    addMember, removeMember, updateMemberRole, transferOwnership,
    createInvite,
  } = useGigaStore();

  // Use currentMapData if it matches, otherwise find from maps list
  const mapData = currentMapData?.id === mapId
    ? currentMapData
    : maps.find((m) => m.id === mapId);

  const members = mapData?.members || {};
  const isOwner = members[user?.uid]?.role === "owner" || mapData?.ownerId === user?.uid;

  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);

  // Lazy migration: add owner to members if this is a legacy map
  useEffect(() => {
    if (mapData && isOwner && (!mapData.members || !mapData.members[user.uid])) {
      addMember(
        mapId,
        user.uid,
        "owner",
        (user.email || "").toLowerCase(),
        user.displayName || user.email || "",
      );
    }
  }, [mapId]);

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
          {/* Invite link section */}
          {isOwner && (
            <div className="modal-section">
              <label>📨 Invitasjonslenke</label>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 10px" }}>
                Generer en lenke du kan sende til hvem som helst
              </p>
              <div className="share-search-row">
                <select
                  value={inviteRole}
                  onChange={(e) => { setInviteRole(e.target.value); setInviteLink(""); setInviteCopied(false); }}
                >
                  <option value="editor">Les og skriv</option>
                  <option value="viewer">Kun les</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const link = await createInvite(mapId, inviteRole);
                    if (link) {
                      setInviteLink(link);
                      await navigator.clipboard.writeText(link);
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 3000);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  {inviteCopied ? "✅ Kopiert!" : "🔗 Lag og kopier lenke"}
                </button>
              </div>
              {inviteLink && (
                <div
                  style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 8,
                    background: "rgba(99,102,241,0.08)", fontSize: 11,
                    color: "var(--text-muted)", wordBreak: "break-all",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                  title="Klikk for å kopiere"
                >
                  {inviteLink}
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
