// Catalogo de efectos. Cada grupo vive en su carpeta; este archivo solo los reexporta.
export * from "./core";
export * from "./text";
export * from "./three";
export * from "./data";
export * from "./ui";
export * from "./art";
// "sub" existe en core (tramo de un progreso) y en three (resta de vectores): aca gana core;
// la de vectores se importa desde "fx/three".
export { sub } from "./core";
