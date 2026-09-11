import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SentinelScope — Audit de sécurité de votre site web";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#07090D",
          backgroundImage: "linear-gradient(135deg, #1b1042 0%, #07090D 55%)",
          color: "#F4F4F5",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marque */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              marginRight: 22,
              backgroundImage: "linear-gradient(150deg, #8B5CF6, #5B21B6)",
              boxShadow: "0 0 60px rgba(139,92,246,0.6)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 30,
                border: "5px solid #F4F4F5",
                borderRightColor: "transparent",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
            <span style={{ color: "#F4F4F5" }}>Sentinel</span>
            <span style={{ color: "#A78BFA" }}>Scope</span>
          </div>
        </div>

        {/* Titre (2 lignes, pas de texte + span mélangés) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 46,
            fontSize: 74,
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: 940,
          }}
        >
          <span style={{ color: "#F4F4F5" }}>Voyez chaque actif exposé</span>
          <span style={{ color: "#A78BFA" }}>avant les attaquants.</span>
        </div>

        {/* Sous-titre (texte seul) */}
        <div
          style={{
            marginTop: 30,
            fontSize: 29,
            color: "#A1A1AA",
            maxWidth: 880,
            lineHeight: 1.35,
          }}
        >
          Audit de sécurité web réel : un score clair, les vulnérabilités
          détectées et les actions à mener — sans installation.
        </div>
      </div>
    ),
    { ...size }
  );
}
