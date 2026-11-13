import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { json, num, one, parseArgs, type Parsed } from './args';
import { formatElement } from './geometry';
import { makeSheet } from './sheet';
import { runPrivacy } from './privacy';
import { failsAt, runQa } from './run';
import { RULES } from './rules';
import { parseOverrides } from './thresholds';
import { ALL_RULES, type Finding, type RuleId } from './types';

const USAGE = {
  sheet: `Uso: ve-sheet <videoId> [--frames 0,60,120 | --every N | --count 12] [--props json] [--cols 4] [--scale 0.25] [--out out/<id>-sheet.png] [--no-labels]`,
  qa: `Uso: ve-qa <videoId> [--frames 0,60,120 | --every N | --count 24] [--props json] [--json salida.json] [--fail-on error|warn] [--verbose] [--max 40]
             [--rules clip,overlap,...] [--skip regla,...] [--set regla.umbral=valor]... [--concurrency N]
Reglas: ${ALL_RULES.join(', ')}  (silenciar: data-qa-ignore="regla" en el elemento o un ancestro)`,
  privacy: `Uso: ve-privacy [<videoId>] --deny lista.txt [--allow lista.txt] [--frames … | --every N | --count 24] [--props json] [--scan-source dir]... [--json salida.json]`,
};

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

async function main(cmd: string, argv: string[]): Promise<number> {
  const usage = USAGE[cmd as keyof typeof USAGE];
  if (!usage) throw new Error(`Comando desconocido: ${cmd}`);
  const p = parseArgs(argv);
  if (p.bools.has('help')) { console.log(usage); return 0; }
  const log = (m: string) => console.error(m);
  const props = json(p, 'props');
  const id = p.positional[0];

  if (cmd === 'sheet') {
    if (!id) throw new Error('Falta <videoId>');
    const r = await makeSheet({ videoId: id, props, ...sample(p), cols: num(p, 'cols'), scale: num(p, 'scale'), out: one(p, 'out'), labels: !p.bools.has('no-labels'), log });
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
    const r = await runQa({
      videoId: id, props, ...sample(p), rules: (only ?? ALL_RULES).filter((x) => !skip.includes(x)),
      thresholds: parseOverrides(p.flags.get('set') ?? []), concurrency: num(p, 'concurrency'), log,
    });
    printQa(r.findings, r.summary.frames, { verbose: p.bools.has('verbose'), max: p.bools.has('verbose') && one(p, 'max') === undefined ? Infinity : num(p, 'max') ?? 40 });
    const s = r.summary;
    const per = Object.entries(s.byRule).map(([k, v]) => `${k}=${v}`).join(' ') || 'ninguno';
    console.log(`\n${id}: ${s.frames.length} cuadros revisados en ${s.seconds}s; ${s.errors} errores, ${s.warnings} avisos, ${s.infos} info${p.bools.has('verbose') ? '' : ' (ocultos; --verbose)'} (${per})`);
    const out = one(p, 'json');
    if (out) {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out, JSON.stringify(r, null, 2));
    }
    return failsAt(r, failOn) ? 1 : 0;
  }

  // privacy
  const denyFile = one(p, 'deny');
  if (!denyFile) throw new Error('Falta --deny <archivo>');
  const dirs = p.flags.get('scan-source') ?? [];
  if (!id && !dirs.length) throw new Error('Indica un <videoId> y/o --scan-source <dir>');
  const allowFile = one(p, 'allow');
  const r = await runPrivacy({
    videoId: id, props, ...sample(p), deny: readFileSync(denyFile, 'utf8'), allow: allowFile ? readFileSync(allowFile, 'utf8') : '', scanSource: dirs, log,
  });
  for (const f of r.findings) {
    console.log(`${f.kind.toUpperCase().padEnd(6)} "${f.value}"${f.term ? ` (termino: ${f.term})` : ''}  en ${f.where}${f.frames ? ` cuadros ${f.frames.join(',')}` : ''}\n       ...${f.context}...`);
  }
  console.log(`\nprivacidad: ${r.ok ? 'OK' : `FALLO (${r.findings.length} hallazgos)`}; ${r.scannedTexts} textos, ${r.scannedFiles} archivos, ${r.frames.length} cuadros`);
  const out = one(p, 'json');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, JSON.stringify(r, null, 2));
  }
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
