// Declaraciones de los imports de archivos que resuelve vite (`import f from "./x.otf?url"`). Se copia junto al tsconfig.json
// de una carpeta de videos fuera del repo (ver templates/externo/README.txt). No usa `types: ["vite/client"]` porque ese paquete
// no se resuelve desde afuera del repo.
declare module "*?url" {
  const url: string;
  export default url;
}
declare module "*?raw" {
  const text: string;
  export default text;
}
declare module "*.png" { const url: string; export default url; }
declare module "*.jpg" { const url: string; export default url; }
declare module "*.jpeg" { const url: string; export default url; }
declare module "*.webp" { const url: string; export default url; }
declare module "*.gif" { const url: string; export default url; }
declare module "*.svg" { const url: string; export default url; }
declare module "*.woff" { const url: string; export default url; }
declare module "*.woff2" { const url: string; export default url; }
declare module "*.ttf" { const url: string; export default url; }
declare module "*.otf" { const url: string; export default url; }
declare module "*.mp3" { const url: string; export default url; }
declare module "*.wav" { const url: string; export default url; }
