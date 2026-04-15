import { useState, useEffect } from "react";

export const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#dc2626", color: "#fff",
      padding: "8px 16px", fontSize: 13, fontWeight: 600,
      textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <line x1="1" y1="1" x2="15" y2="15" /><path d="M2 8.5C3.5 5 6.5 3 8 3c1 0 2.5.5 3.5 1.5" />
        <path d="M5 11c1-1 2-1.5 3-1.5s2 .5 3 1.5" /><circle cx="8" cy="14" r="1" fill="#fff" stroke="none" />
      </svg>
      You're offline — some features may not work
    </div>
  );
};