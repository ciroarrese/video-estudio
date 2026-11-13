import React from "react";
import type { Camera } from "./camera";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Mundo con cámara: coloca a los hijos (en coordenadas del mundo) aplicando
 * traslado al centro, rotación, escala y traslado por -foco, más el desenfoque.
 *
 * Con inclinación, la perspectiva va como `perspective()` dentro del `transform` del propio elemento
 * (sin `perspective` ni `transform-style: preserve-3d` en un ancestro) y el elemento se ubica en
 * `left: 0; top: 0` enteros con todo el movimiento dentro del `transform`: así Chromium rasteriza
 * igual sin importar el historial de cuadros. El mundo se inclina como un plano.
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
  const tilt = flat ? "" : ` perspective(${perspective}px) rotateX(${r3(camera.rx)}deg) rotateY(${r3(camera.ry)}deg)`;
  // El desenfoque solo se emite mientras hay (React agrega al final las propiedades que reaparecen; con `key` el orden no depende del historial).
  const st: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    transformOrigin: "0 0",
    transform: `translate(${width / 2}px, ${height / 2}px)${tilt} scale(${r3(camera.scale)}) translate(${r3(-camera.x)}px, ${r3(-camera.y)}px)`,
    filter: camera.blur > 0.3 ? `blur(${camera.blur.toFixed(1)}px)` : undefined,
  };
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <div key={st.filter ? "blur" : "sharp"} style={st}>
        {children}
      </div>
    </div>
  );
}
