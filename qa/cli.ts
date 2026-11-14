import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { json, num, one, parseArgs, type Parsed } from './args';
import { formatElement } from './geometry';
import { makeSheet } from './sheet';
import { openSession } from './session';
import { budgetFromScenes, formatStoryBudget } from '../stories/budget';
import { formatSceneList, parseFormat, suffixOf } from '../render/index';
import { salidaPorDefecto } from '../render/dirs';
import { runPrivacy } from './privacy';
import { failsAt, runQa } from './run';
import { RULES } from './rules';
import { canonicalReport as canonical, diffReports } from './repeat';
import { parseOverrides } from './thresholds';
import { ALL_RULES, type Finding, type JudgedSummary, type RuleId } from './types';
import { buildMatrix, formatDifferences, formatMatrix, parseThemes, runQaThemes } from './themes';

const USAGE = {
  sheet: `Uso: ve-sheet <videoId> [--frames 0,60,120 | --every N | --count 12] [--props json] [--format horizontal|vertical|cuadrado] [--scene id|índice] [--list-scenes]
             [--assets dir]... [--allow-missing-fonts] [--cols 4] [--scale 0.25] [--out out/<id>[-<formato>]-sheet.png] [--no-labels]   (--out acepta cualquier ruta, se crean las carpetas)`,
  qa: `Uso: ve-qa <videoId> [--frames 0,60,120 | --every N | --count 24] [--props json] [--format horizontal|vertical|cuadrado] [--scene id|índice] [--list-scenes] [--json salida.json | --out salida.json] [--fail-on error|warn] [--verbose] [--max 40]
             [--assets dir]... [--allow-missing-fonts] [--rules clip,overlap,...] [--skip regla,...] [--set regla.umbral=valor]... [--concurrency N] [--repeat N]
             [--themes neutral,dark,editorial,neon,papel|all] [--font-scale 1.2] [--font-fallback wide|narrow]
Reglas: ${ALL_RULES.join(', ')}  (silenciar: data-qa-ignore="regla" en el elemento o un ancestro; adorno de interfaz: data-qa-decor)`,
  privacy: `Uso: ve-privacy [<videoId>] --deny lista.txt [--allow lista.txt] [--frames … | --every N | --count 24] [--props json] [--format …] [--scene id|índice] [--scan-source dir]... [--assets dir]... [--allow-missing-fonts] [--json salida.json | --out salida.json]`,
};

/** Opciones comunes de estáticos y fuentes (`--assets`, `--allow-missing-fonts`) que entienden sheet, qa y privacy. */
const common = (p: Parsed) => ({ assets: p.flags.get('assets'), allowMissingFonts: p.bools.has('allow-missing-fonts') || undefined });

const sample = (p: Parsed) => ({ frames: one(p, 'frames'), every: num(p, 'every'), count: num(p, 'count') });

const RANK = { error: 2, warn: 1, info: 0 } as const;

/** "78–143" style: runs of consecutive sampled frames collapse into ranges. */
export function frameRanges(frames: number[], sampled: number[]): string {
  const order = new Map([...sampled].sort((x, y) => x - y).map((f, i) => [f, i]));
  const fs = [...new Set(frames)].sort((x, y) => x - y);
  const out: string[] = [];
  for (let i = 0; i < fs.length; ) {
    let j = i;
    while (j + 1 < fs.length && order.has(fs[j]!) && order.get(fs[j + 1]!) === order.get(fs[j]!)! + 1) j++;
    out.push(j > i ? `${fs[i]}\u2013${fs[j]}` : `${fs[i]}`);
    i = j + 1;
  }
  return out.join(', ');
}

/** One group per rule + element (+ partner element): worst severity wins, frames are merged. */
export function groupFindings(findings: Finding[]): { first: Finding; severity: Finding['severity']; frames: number[]; counts: Record<string, number> }[] {
  const groups = new Map<string, { first: Finding; severity: Finding['severity']; frames: number[]; counts: Record<string, number> }>();
  for (const f of findings) {
    const key = [f.rule, f.element.tag, f.element.testid, f.element.text, f.other?.text ?? ''].join('|');
    const g = groups.get(key);
    if (g) {
      g.frames.push(f.frame);
      g.counts[f.severity] = (g.counts[f.severity] ?? 0) + 1;
      if (RANK[f.severity] > RANK[g.severity]) { g.severity = f.severity; g.first = f; }
    } else groups.set(key, { first: f, severity: f.severity, frames: [f.frame], counts: { [f.severity]: 1 } });
  }
  return [...groups.values()];
}

function printQa(findings: Finding[], sampled: number[], o: { verbose: boolean; max: number }) {
  const shown = o.verbose ? findings : findings.filter((f) => f.severity !== 'info');
  let lines = 0;
  let more = 0;
  for (const rule of RULES) {
    const groups = groupFindings(shown.filter((f) => f.rule === rule.id));
    if (!groups.length) continue;
    const room = Math.max(0, o.max - lines);
    console.log(`\n[${rule.id}] ${rule.description}: ${groups.length} elementos`);
    groups.sort((a, b) => RANK[b.severity] - RANK[a.severity] || a.frames[0]! - b.frames[0]!);
    groups.forEach(({ first: f, severity, frames }, i) => {
      if (i >= room) { more++; return; }
      lines++;
      console.log(`  ${severity === 'error' ? 'ERROR' : severity === 'warn' ? 'warn ' : 'info '} ${frameRanges(frames, sampled)}  ${formatElement(f.element)}: ${f.message}${f.other ? ` | con ${formatElement(f.other)}` : ''}`);
    });
  }
  if (more) console.log(`\n… ${more} más (--max N o --verbose)`);
}

const n = (x: number) => String(x);

/** La linea que dice cuanto texto juzgo el control y cuanto no (y por que): hace imposible no ver la ceguera. */
export function formatJudged(j: JudgedSummary): string[] {
  const out: string[] = [];
  const pct = j.texts ? Math.round((100 * j.judged) / j.texts) : 100;
  const nj = j.notJudged;
  const why = [
    nj.hidden ? `tapados por una capa opaca de cuadro completo ${nj.hidden}` : '', nj.outside ? `fuera del cuadro ${nj.outside}` : '', nj.invisible ? `casi transparentes ${nj.invisible}` : '',
    nj.ignoredAll ? `excluidos por data-qa-ignore de todas las reglas ${nj.ignoredAll}` : '',
  ].filter(Boolean);
  out.push(`juzgados: ${n(j.judged)} de ${n(j.texts)} textos x cuadros (${pct}%); NO juzgados: ${n(nj.total)}${why.length ? ` (${why.join('; ')})` : ''}`);
  const part = [j.partial.decor ? `adorno (sin min-size ni contrast) ${j.partial.decor}` : '', j.partial.veil ? `bajo un velo de transicion (contrast baja a info) ${j.partial.veil}` : '', j.partial.gradientText ? `con relleno de degradado (contrast no los puede juzgar) ${j.partial.gradientText}` : '',
    j.partial.ignoredSome ? `con marcas data-qa-ignore de algunas reglas ${j.partial.ignoredSome} (${Object.entries(j.ignoredByRule).sort(([a], [b]) => a.localeCompare(b)).map(([r, c]) => `${r}: ${c}`).join(', ')})` : ''].filter(Boolean);
  if (part.length) out.push(`  juzgados solo en parte: ${part.join('; ')}`);
  if (j.coverMarkerSkipped) out.push(`  ${n(j.coverMarkerSkipped)} textos x cuadros tenian encima una capa solida con data-qa-ignore="covered" (no se informa como tapa)`);
  if (j.hiddenButVisible) out.push(`  ATENCION: ${n(j.hiddenButVisible)} textos x cuadros que el control creia tapados por una capa de cuadro completo SE VEN en pantalla; se juzgaron igual (revisar la capa que los tapa)`);
  if (j.texts && nj.hidden / j.texts >= 0.5) out.push(`  ATENCION: mas de la mitad del texto (${Math.round((100 * nj.hidden) / j.texts)}%) quedo sin juzgar por estar bajo una capa opaca: un "0 errores" aca no dice nada; revisar con --verbose y la hoja`);
  if (j.unjudgedVisible) out.push(`  ERROR del control: ${n(j.unjudgedVisible)} textos x cuadros se ven en pantalla y no los juzgo ninguna regla (regla unjudged)`);
  return out;
}

/** Escribe el informe JSON (`--out` o `--json`, cualquier ruta; crea las carpetas) y dice dónde quedó. */
function writeReport(out: string | undefined, data: unknown) {
  if (!out) return;
  const abs = resolve(out);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 2));
  console.log(`informe: ${abs}`);
}

async function main(cmd: string, argv: string[]): Promise<number> {
  const usage = USAGE[cmd as keyof typeof USAGE];
  if (!usage) throw new Error(`Comando desconocido: ${cmd}`);
  const p = parseArgs(argv);
  if (p.bools.has('help')) { console.log(usage); return 0; }
  const log = (m: string) => console.error(m);
  const props = json(p, 'props');
  const id = p.positional[0];
  const format = parseFormat(one(p, 'format'));
  const scene = one(p, 'scene');

  if (p.bools.has('list-scenes')) {
    if (!id) throw new Error('Falta <videoId>');
    const session = await openSession({ videoId: id, props, format, ...common(p), log });
    try {
      const scenes = await session.scenes();
      console.log(formatSceneList(id, scenes, session.meta.fps));
      // si es una historia (defineStory), el presupuesto de cuadros por bloque
      const budget = budgetFromScenes(scenes, session.meta.fps);
      if (budget) console.log(`\n${formatStoryBudget(budget)}`);
    } finally {
      await session.close();
    }
    return 0;
  }

  if (cmd === 'sheet') {
    if (!id) throw new Error('Falta <videoId>');
    const r = await makeSheet({ videoId: id, props, format, scene, ...sample(p), cols: num(p, 'cols'), scale: num(p, 'scale'), out: one(p, 'out') ?? salidaPorDefecto(`${id}${suffixOf({ format, scene })}-sheet.png`), labels: !p.bools.has('no-labels'), ...common(p), log });
    console.log(`hoja: ${r.out} (${r.width}x${r.height}, ${r.frames.length} cuadros: ${r.frames.join(',')})`);
    return 0;
  }

  if (cmd === 'qa') {
    if (!id) throw new Error('Falta <videoId>');
    const only = one(p, 'rules')?.split(',').filter(Boolean) as RuleId[] | undefined;
    const skip = (one(p, 'skip')?.split(',').filter(Boolean) ?? []) as RuleId[];
    for (const r of [...(only ?? []), ...skip]) if (!ALL_RULES.includes(r)) throw new Error(`Regla desconocida: ${r}`);
    const failOn = one(p, 'fail-on') ?? 'error';
    if (failOn !== 'error' && failOn !== 'warn') throw new Error('--fail-on debe ser error o warn');
    const repeat = num(p, 'repeat') ?? 1;
    if (!Number.isInteger(repeat) || repeat < 1) throw new Error('--repeat debe ser un entero >= 1');
    const fontScale = num(p, 'font-scale');
    if (fontScale !== undefined && !(fontScale > 0 && fontScale <= 4)) throw new Error('--font-scale debe ser un numero entre 0 y 4 (1.2 = letra 20 % mas grande)');
    const fallback = one(p, 'font-fallback');
    if (fallback !== undefined && fallback !== 'wide' && fallback !== 'narrow') throw new Error('--font-fallback debe ser wide o narrow');
    const stress = fontScale !== undefined || fallback !== undefined ? { ...(fontScale !== undefined ? { fontScale } : {}), ...(fallback ? { fontFallback: fallback as 'wide' | 'narrow' } : {}) } : undefined;
    const themesSpec = one(p, 'themes');
    const themes = themesSpec !== undefined ? parseThemes(themesSpec) : undefined;
    if (themes && props && 'theme' in props) throw new Error('--themes y --props con "theme" se pisan: dejá solo uno');
    const qaOpts = {
      videoId: id, props, format, scene, ...sample(p), rules: (only ?? ALL_RULES).filter((x) => !skip.includes(x)),
      thresholds: parseOverrides(p.flags.get('set') ?? []), concurrency: num(p, 'concurrency'), stress, ...common(p), log,
    };
    const verbose = p.bools.has('verbose');
    const max = verbose && one(p, 'max') === undefined ? Infinity : num(p, 'max') ?? 40;

    // Resumen de un informe (lo mismo en un solo sistema que en cada uno de --themes).
    const printSummary = (r: Awaited<ReturnType<typeof runQa>>, label = '') => {
      printQa(r.findings, r.summary.frames, { verbose, max });
      const s = r.summary;
      if (s.detailSmallText) console.log(`\ninfo: ${s.detailSmallText.texts} ${s.detailSmallText.texts === 1 ? 'texto' : 'textos'} por debajo del mínimo en el plano general ${s.detailSmallText.texts === 1 ? 'se lee' : 'se leen'} al acercar dentro de su escena (detalle, no es error; ${s.detailSmallText.frames} ${s.detailSmallText.frames === 1 ? 'cuadro afectado' : 'cuadros afectados'}; --verbose lo muestra por cuadro)`);
      if (s.decor) console.log(`\ninfo: ${s.decor.texts} ${s.decor.texts === 1 ? 'texto de adorno' : 'textos de adorno'} (data-qa-decor) quedaron fuera de min-size y contrast (${s.decor.frames} ${s.decor.frames === 1 ? 'cuadro' : 'cuadros'}); clip, overlap contra texto normal y offscreen (si es data-qa-decor="main") siguen aplicando`);
      if (s.fixedScale) {
        const fx = s.fixedScale;
        console.log(fx.refused
          ? `\nADVERTENCIA: data-qa-fixed-scale RECHAZADA: cubre todo el escenario y no hay otro texto fuera de la marca en ningun cuadro revisado; apagaria el estres de todo el video. Se aplico el estres igual (${fx.texts} ${fx.texts === 1 ? 'texto habria quedado' : 'textos habrian quedado'} exento${fx.texts === 1 ? '' : 's'}). Marcar solo la reproduccion, no el escenario entero`
          : `\ninfo: ${fx.texts} ${fx.texts === 1 ? 'texto' : 'textos'} fuera del estres de tipografia por data-qa-fixed-scale (${fx.frames} ${fx.frames === 1 ? 'cuadro' : 'cuadros'}); el resto de las reglas los sigue juzgando`);
      }
      if (s.silenced) {
        const parts = Object.entries(s.silenced).map(([rule, c]) => `${rule}: ${[c.ignore ? `${c.ignore} por data-qa-ignore` : '', c.decor ? `${c.decor} por data-qa-decor` : ''].filter(Boolean).join(', ')}`);
        console.log(`\ncallados (no cuentan arriba): ${parts.join('; ')}`);
      }
      console.log('');
      for (const l of formatJudged(s.judged)) console.log(l);
      const per = Object.entries(s.byRule).map(([k, v]) => `${k}=${v}`).join(' ') || 'ninguno';
      console.log(`\n${label}${id}: ${s.frames.length} cuadros revisados en ${s.seconds}s; ${s.errors} errores, ${s.warnings} avisos, ${s.infos} info${verbose ? '' : ' (ocultos; --verbose)'} (${per})`);
    };
    if (stress) console.log(`estres de tipografia: ${[stress.fontScale !== undefined ? `letra x${stress.fontScale}` : '', stress.fontFallback ? `fuente de reemplazo ${stress.fontFallback}` : ''].filter(Boolean).join(', ')}`);

    // --themes: el mismo control bajo cada design system, con una matriz y las diferencias entre ellos.
    if (themes) {
      const reports = await runQaThemes(qaOpts, themes);
      let unstable = false;
      for (let i = 2; i <= repeat; i++) {
        const again = await runQaThemes(qaOpts, themes);
        for (const t of themes) {
          const diff = diffReports(reports[t]!, again[t]!);
          if (diff.length) {
            unstable = true;
            console.log(`\nREPETICION ${i}/${repeat} [${t}]: el informe difiere de la primera corrida (${diff.length} ${diff.length === 1 ? 'diferencia' : 'diferencias'}):`);
            for (const d of diff.slice(0, 40)) console.log(`  ${d}`);
          }
        }
      }
      for (const t of themes) { console.log(`\n===== sistema: ${t} =====`); printSummary(reports[t]!, `[${t}] `); }
      const matrix = buildMatrix(reports);
      console.log(`\n===== matriz (${id}) =====\n${formatMatrix(matrix)}\n\n${formatDifferences(matrix, max === Infinity ? 1e9 : max)}`);
      if (themes.length > 1 && themes.every((t) => canonical(reports[t]!) === canonical(reports[themes[0]!]!))) console.log('\nnota: los informes de todos los sistemas son iguales; si el video no lee props.theme, la matriz no prueba nada (hello y audio-check no lo leen)');
      writeReport(one(p, 'out') ?? one(p, 'json'), { themes, reports, matrix });
      if (repeat > 1) console.log(unstable ? `\nrepeticiones: NO reproducible (algún informe de ${repeat} difiere del primero)` : `\nrepeticiones: ${repeat} corridas con informes idénticos (salvo el tiempo)`);
      if (unstable) return 3;
      return themes.some((t) => failsAt(reports[t]!, failOn)) ? 1 : 0;
    }

    const r = await runQa(qaOpts);
    // --repeat N: autocomprobación. Corre el mismo control N veces; si algún informe difiere del primero, imprime qué hallazgos
    // cambian y falla (código 3): el control tiene que ser determinista. Sin diferencias, sigue como siempre con el primer informe.
    let unstable = false;
    for (let i = 2; i <= repeat; i++) {
      const again = await runQa(qaOpts);
      const diff = diffReports(r, again);
      if (diff.length) {
        unstable = true;
        console.log(`\nREPETICION ${i}/${repeat}: el informe difiere de la primera corrida (${diff.length} ${diff.length === 1 ? 'diferencia' : 'diferencias'}):`);
        for (const d of diff.slice(0, 40)) console.log(`  ${d}`);
        if (diff.length > 40) console.log(`  … ${diff.length - 40} más`);
      }
    }
    printSummary(r);
    writeReport(one(p, 'out') ?? one(p, 'json'), r);
    if (repeat > 1) console.log(unstable ? `\nrepeticiones: NO reproducible (algún informe de ${repeat} difiere del primero)` : `\nrepeticiones: ${repeat} corridas con informes idénticos (salvo el tiempo)`);
    if (unstable) return 3;
    return failsAt(r, failOn) ? 1 : 0;
  }

  // privacy
  const denyFile = one(p, 'deny');
  if (!denyFile) throw new Error('Falta --deny <archivo>');
  const dirs = p.flags.get('scan-source') ?? [];
  if (!id && !dirs.length) throw new Error('Indica un <videoId> y/o --scan-source <dir>');
  const allowFile = one(p, 'allow');
  const r = await runPrivacy({
    videoId: id, props, format, scene, ...sample(p), deny: readFileSync(denyFile, 'utf8'), allow: allowFile ? readFileSync(allowFile, 'utf8') : '', scanSource: dirs, skipFiles: [denyFile, ...(allowFile ? [allowFile] : [])], ...common(p), log,
  });
  for (const f of r.findings) {
    console.log(`${f.kind.toUpperCase().padEnd(11)} "${f.value}"${f.term ? ` (termino: ${f.term})` : ''}  en ${f.where}${f.frames ? ` cuadros ${f.frames.join(',')}` : ''}\n       ...${f.context}...`);
    if (f.kind === 'deny-joined') console.log('       (solo aparece al juntar textos de elementos o letras sueltas de la misma linea: no esta en ningun nodo de texto entero; si en pantalla se lee como dos cosas distintas, es un falso positivo: ajustar la lista o usar --allow)');
  }
  console.log(`\nprivacidad: ${r.ok ? 'OK' : `FALLO (${r.findings.length} hallazgos)`}; ${r.scannedTexts} textos, ${r.scannedFiles} archivos, ${r.frames.length} cuadros`);
  writeReport(one(p, 'out') ?? one(p, 'json'), r);
  return r.ok ? 0 : 1;
}

const [cmd, ...rest] = process.argv.slice(2);
let code: number;
try {
  code = await main(cmd ?? '', rest);
} catch (e) {
  console.error(`Error: ${(e as Error).message}`);
  code = 2;
}
process.exit(code);
