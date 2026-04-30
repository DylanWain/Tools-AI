import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f0eee6",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontSize: 26,
          fontWeight: 500,
          color: "#cc785c",
          borderRadius: 7,
        }}
      >
        V
      </div>
    ),
    { ...size }
  );
}
