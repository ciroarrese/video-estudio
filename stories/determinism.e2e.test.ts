// @vitest-environment node
// `--check` por escena (apertura, primera vuelta, cierre) de historias con títulos, temas y etiquetas muy distintos.
// El muestreo por defecto de una historia entera (12 cuadros parejos) puede saltearse un fallo de la apertura que `--scene opening` sí ve,
// así que acá se verifica cada bloque por separado. Cada caso es un video temporal (carpeta propia, id propio) con su `StorySpec`.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { engineDir, withTempVideos } from '../render/testing';

const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const hasPlaywright = (() => {
  try {
    createRequire(import.meta.url)('playwright');
    return true;
  } catch {
    return false;
  }
})();
const ready = hasPlaywright && has('ffmpeg', ['-version']);

const root = resolve(__dirname, '..');
const storiesDir = join(root, 'stories');

type Topic = { id: string; name: string; line: string };
type Case = { id: string; spec: Record<string, unknown>; storyOpts?: Record<string, unknown> };

const T = (n: number, long = false): Topic[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: long ? `Un nombre de tema bastante largo número ${i + 1} del recorrido` : `Tema ${i + 1}`, line: long ? "una línea descriptiva que también es larga, para forzar el ajuste del texto" : `línea del tema ${i + 1}` }));

export const CASES: Case[] = [
  { id: "d-corto", spec: { title: { text: "Hola" }, topics: T(2), labels: ["Uno", "Dos"], signoff: { text: "Chau" } } },
  { id: "d-resaltado", spec: { title: { text: "Un día en la oficina", highlight: "la oficina" }, topics: T(3), labels: ["Resumen diario", "Metas del mes", "Pedidos nuevos"], signoff: { text: "Gracias por mirar", tagline: "Datos ficticios" } } },
  { id: "d-largo", spec: { title: { text: "Cómo ordenamos el trabajo de todo el equipo durante el año entero, paso por paso", highlight: "paso por paso" }, topics: T(4), labels: [], signoff: { text: "Hasta la próxima vez que nos veamos por acá", tagline: "Una nota de pie algo más larga que de costumbre" } } },
  { id: "d-seis", spec: { title: { text: "Seis temas con nombres largos" }, topics: T(6, true), labels: ["A", "B", "C", "D", "E", "F", "G", "H"], signoff: { text: "Fin" } } },
  { id: "d-acentos", spec: { title: { text: "¿Qué hicimos esta semana? Ñandú, óptica y más", highlight: "Ñandú" }, topics: T(3, true), labels: ["Año nuevo", "Ñoquis", "Canción", "Pingüino", "Éxito", "Último"], signoff: { text: "¡Gracias!" } } },
  { id: "d-una-palabra", spec: { title: { text: "Resumen" }, topics: T(5), labels: ["Etiqueta con bastante texto para ajustar el ancho de la pieza del muro"], signoff: { text: "Listo", tagline: "Fin" } } },
  { id: "d-timing", spec: { title: { text: "Tiempos propios del recorrido", highlight: "propios" }, topics: T(3), labels: ["x", "y", "z"], signoff: { text: "Cierre" }, timing: { opening: 150, interlude: 70, closing: 200 } } },
];

const sceneSource = `
const Scene = () => {
  const f = useFrame();
  return React.createElement(React.Fragment, null,
    React.createElement(TopicHeadline, { start: 4 }),
    React.createElement("div", { style: { position: "absolute", left: 200, top: 300, width: 400 + f, height: 200, background: "transparent" } }));
};`;

function videoFile(c: Case): string {
  return `import React from "react";
import { useFrame } from ${JSON.stringify(engineDir)};
import { defineStory, TopicHeadline } from ${JSON.stringify(storiesDir)};
${sceneSource}
const spec = ${JSON.stringify(c.spec)};
const scenes = spec.topics.map((t) => ({ id: t.id, component: Scene, durationInFrames: 60 }));
export default defineStory({ id: ${JSON.stringify(c.id)}, spec, scenes, ...${JSON.stringify(c.storyOpts ?? {})} });
`;
}

describe.skipIf(!ready)('historias: --check por escena (apertura, vuelta, cierre) con varios títulos', () => {
  it('todas las escenas generadas son deterministas', async () => {
    const { checkVideo } = await import('../render/render');
    const out = mkdtempSync(join(tmpdir(), 've-story-det-'));
    try {
      await withTempVideos(async (dir) => {
        for (const c of CASES) {
          mkdirSync(join(dir, c.id));
          writeFileSync(join(dir, c.id, 'index.tsx'), videoFile(c));
        }
        const failures: string[] = [];
        for (const c of CASES) {
          for (const scene of ['opening', 'interlude-1', 'closing']) {
            const logs: string[] = [];
            const r = await checkVideo({ videoId: c.id, scene, cacheDir: join(out, 'cache'), log: (m) => logs.push(m) });
            if (!r.ok) failures.push(`${c.id} / ${scene}\n${logs.filter((l) => /FALLA|DIFERENTE|cambian|elementos|style/.test(l)).slice(0, 8).join('\n')}`);
          }
        }
        expect(failures, failures.join('\n---\n')).toEqual([]);
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 1_800_000);
});
