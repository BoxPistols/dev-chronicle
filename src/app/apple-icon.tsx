import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: "#1a1a2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 140,
            height: 150,
            borderRadius: 8,
            background: "#f5f0e8",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div
            style={{
              width: 110,
              height: 4,
              background: "#1a1a2e",
              borderRadius: 2,
              marginBottom: 4,
            }}
          />
          <div
            style={{
              width: 110,
              height: 2,
              background: "#1a1a2e",
              borderRadius: 1,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#1a1a2e",
              fontFamily: "serif",
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            DC
          </div>
          <div
            style={{
              width: 110,
              height: 2,
              background: "#1a1a2e",
              borderRadius: 1,
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 6, width: 110 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ height: 3, background: "#666", borderRadius: 1 }} />
              <div style={{ height: 2, background: "#aaa", borderRadius: 1 }} />
              <div style={{ height: 2, background: "#aaa", borderRadius: 1 }} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ height: 3, background: "#666", borderRadius: 1 }} />
              <div style={{ height: 2, background: "#aaa", borderRadius: 1 }} />
              <div style={{ height: 2, background: "#aaa", borderRadius: 1 }} />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
