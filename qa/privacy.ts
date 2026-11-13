import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { collectAllText } from './page';
import { collectStrings, parseTermList, scanText, type Hit, type Term } from './privacyCore';
import { sampleFrames, type SampleSpec } from './sampling';
import { openSession } from './session';

export type PrivacyFinding = Hit & { where: string; frames?: number[]; context: string };

export type PrivacyOptions = Partial<SampleSpec> & {
  videoId?: string;
  props?: Record<string, unknown>;
  /** Contents (not paths) of the deny / allow lists. */
  deny: string;
  allow?: string;
  /** Directories to grep for the same terms (deny list, e-mails, URL hosts). */
  scanSource?: string[];
  log?: (m: string) => void;
};
export type PrivacyResult = { ok: boolean; findings: PrivacyFinding[]; frames: number[]; scannedTexts: number; scannedFiles: number };

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.txt', '.yml', '.yaml', '.svg']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'out', '.git', '.ve-cache']);

function* walkSource(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkSource(p);
    else if (e.isFile() && SOURCE_EXT.has(extname(e.name).toLowerCase()) && statSync(p).size < 2_000_000) yield p;
  }
}

const ctx = (text: string, value: string) => {
  const i = text.toLowerCase().indexOf(value.toLowerCase());
  const s = Math.max(0, (i < 0 ? 0 : i) - 20);
  return text.slice(s, s + value.length + 40).replace(/\s+/g, ' ');
};

export async function runPrivacy(o: PrivacyOptions): Promise<PrivacyResult> {
  const deny: Term[] = parseTermList(o.deny);
  const allow: Term[] = parseTermList(o.allow ?? '');
  const findings = new Map<string, PrivacyFinding>();
  const add = (h: Hit, where: string, context: string, frame?: number) => {
    const key = `${h.kind}|${h.value.toLowerCase()}|${where}`;
    const f = findings.get(key);
    if (f) {
      if (frame !== undefined && !f.frames!.includes(frame)) f.frames!.push(frame);
    } else findings.set(key, { ...h, where, context, ...(frame !== undefined ? { frames: [frame] } : {}) });
  };
  let frames: number[] = [];
  let scannedTexts = 0;
  let scannedFiles = 0;

  if (o.videoId) {
    const session = await openSession({ videoId: o.videoId, props: o.props, log: o.log });
    try {
      frames = sampleFrames(o, session.meta.durationInFrames, 24);
      for (const s of collectStrings(o.props ?? {})) {
        scannedTexts++;
        for (const h of scanText(s, deny, allow)) add(h, 'props', ctx(s, h.value));
      }
      const vp = await session.openPage();
      for (const f of frames) {
        await vp.setFrame(f);
        for (const t of await collectAllText(vp)) {
          scannedTexts++;
          for (const h of scanText(t, deny, allow)) add(h, 'pantalla', ctx(t, h.value), f);
        }
      }
    } finally {
      await session.close();
    }
  }
  for (const dir of o.scanSource ?? []) {
    for (const file of walkSource(dir)) {
      scannedFiles++;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const h of scanText(line, deny, allow, { phones: false, domains: /https?:\/\//i.test(line) })) {
          // In source, only domains that appear as URLs are considered (keeps `foo.bar` code paths quiet).
          if (h.kind === 'domain' && !new RegExp(`https?://[^\\s'"]*${h.value.replace(/\./g, '\\.')}`, 'i').test(line)) continue;
          add(h, `${relative(process.cwd(), file)}:${i + 1}`, line.trim().slice(0, 100));
        }
      });
    }
  }
  const list = [...findings.values()];
  list.forEach((f) => f.frames?.sort((a, b) => a - b));
  return { ok: list.length === 0, findings: list, frames, scannedTexts, scannedFiles };
}
