// @vitest-environment node
// `npm run doctor`: funciones puras del diagnóstico y un arranque real con --help.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carpetasDeSalida, codigoDeSalida, cumpleNode, formatearBytes, lineaDeInforme, nodeMinimoDe, tieneCodificador, versionDeFfmpeg } from './doctor.mjs';

describe('render/doctor.mjs', () => {
  it('lee el mínimo de Node de engines y compara versiones', () => {
    expect(nodeMinimoDe('>=22')).toBe(22);
    expect(nodeMinimoDe('>= 22.1.0')).toBe(22);
    expect(nodeMinimoDe('^22')).toBeNull();
    expect(cumpleNode('v22.4.1', 22)).toBe(true);
    expect(cumpleNode('24.0.0', 22)).toBe(true);
    expect(cumpleNode('v20.11.0', 22)).toBe(false);
    expect(cumpleNode('raro', 22)).toBe(false);
  });

  it('extrae la versión de ffmpeg y reconoce codificadores', () => {
    expect(versionDeFfmpeg('ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023')).toBe('6.1.1-3ubuntu5');
    expect(versionDeFfmpeg('ffprobe version n7.0 Copyright')).toBe('n7.0');
    expect(versionDeFfmpeg('nada')).toBeNull();
    const enc = ' V....D libx264              libx264 H.264\n V....D libx264rgb           otro\n A....D aac                  AAC\n';
    expect(tieneCodificador(enc, 'libx264')).toBe(true);
    expect(tieneCodificador(enc, 'aac')).toBe(true);
    expect(tieneCodificador(' V....D libx264rgb  x\n', 'libx264')).toBe(false);
    expect(tieneCodificador('', 'aac')).toBe(false);
  });

  it('formatea bytes con coma decimal', () => {
    expect(formatearBytes(512)).toBe('512 B');
    expect(formatearBytes(1536)).toBe('1,5 KB');
    expect(formatearBytes(5 * 1024 ** 3)).toBe('5,0 GB');
  });

  it('resuelve las carpetas de salida como render/dirs.ts', () => {
    expect(carpetasDeSalida({}, '/repo', '/cwd')).toEqual({ videosExterna: null, cache: '/repo/.ve-cache', salida: '/cwd/out' });
    expect(carpetasDeSalida({ VE_VIDEOS_DIR: '/priv' }, '/repo', '/cwd')).toEqual({ videosExterna: '/priv', cache: '/priv/.ve-cache', salida: '/priv/out' });
    const c = carpetasDeSalida({ VE_VIDEOS_DIR: '/priv', VE_CACHE_DIR: '/c', VE_OUT_DIR: '/o' }, '/repo', '/cwd');
    expect(c.cache).toBe('/c');
    expect(c.salida).toBe('/o');
  });

  it('da el código de salida y las líneas del informe', () => {
    expect(codigoDeSalida([{ nombre: 'a', estado: 'ok' }, { nombre: 'b', estado: 'aviso' }])).toBe(0);
    expect(codigoDeSalida([{ nombre: 'a', estado: 'ok' }, { nombre: 'b', estado: 'falta' }])).toBe(1);
    expect(lineaDeInforme({ nombre: 'Node', estado: 'ok', detalle: 'v22' })).toBe('OK     Node: v22');
    const l = lineaDeInforme({ nombre: 'ffmpeg', estado: 'falta', detalle: 'no está', arreglo: 'instalalo' });
    expect(l).toContain('FALTA  ffmpeg: no está');
    expect(l).toContain('-> instalalo');
  });

  it('--help sale con 0 y una opción desconocida con 2', () => {
    const exe = resolve(__dirname, 'doctor.mjs');
    expect(spawnSync(process.execPath, [exe, '--help'], { encoding: 'utf8' }).status).toBe(0);
    expect(spawnSync(process.execPath, [exe, '--nada'], { encoding: 'utf8' }).status).toBe(2);
  });
});
