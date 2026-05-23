import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function AuthPage() {
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
      setError(`${err.code}: ${err.message}`);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card">
        <div className="auth-logo">🗺 Gigamapping</div>
        <p className="auth-subtitle">
          Visualiser, strukturér og planlegg komplekse systemer.<br />
          Koble avdelinger, prosesser og strukturer visuelt.
        </p>

        <div style={{ marginBottom: 28, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 28 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, justifyContent: "center" }}>
            {["🏢 Avdelinger", "🔗 Koblinger", "🤖 AI-eksport"].map((f) => (
              <div key={f} style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{f}</div>
            ))}
          </div>
        </div>

        <button className="btn auth-google-btn" onClick={handleGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Logg inn med Google
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            fontSize: 12, color: "#f87171", lineHeight: 1.5, textAlign: "left",
            wordBreak: "break-word",
          }}>
            ⚠️ {error}
          </div>
        )}

        <p style={{ marginTop: 20, fontSize: 11, color: "var(--text-muted)" }}>
          Data lagres sikkert i Firebase Cloud
        </p>
      </div>
    </div>
  );
}
