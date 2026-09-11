import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07090D",
          backgroundImage: "linear-gradient(150deg, #1b1042, #07090D)",
        }}
      >
        <div
          style={{
            width: 116,
            height: 116,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 30,
            background: "linear-gradient(150deg, #8B5CF6, #5B21B6)",
            boxShadow: "0 0 40px rgba(139,92,246,0.6)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "10px solid #F4F4F5",
              borderRightColor: "transparent",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
