import React from "react";
import type { Camera } from "./camera";

/**
 * Mundo con cámara: coloca a los hijos (en coordenadas del mundo) aplicando
 * traslado al centro, rotación, escala y traslado por -foco, más el desenfoque.
 */
export function World({
  camera,
  width,
  height,
  perspective = 2400,
  children,
}: {
  camera: Camera;
  width: number;
  height: number;
  perspective?: number;
  children?: React.ReactNode;
}) {
  const flat = Math.abs(camera.rx) < 1e-6 && Math.abs(camera.ry) < 1e-6;
  const rot = flat ? "" : ` rotateX(${camera.rx}deg) rotateY(${camera.ry}deg)`;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height, perspective: flat ? undefined : perspective }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          transformOrigin: "0 0",
          transformStyle: flat ? undefined : "preserve-3d",
          transform: `translate(${width / 2}px, ${height / 2}px)${rot} scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`,
          filter: camera.blur > 0.3 ? `blur(${camera.blur.toFixed(1)}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
