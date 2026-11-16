import { describe, expect, it } from 'vitest';
import { datoFaltante } from './datoFaltante';

describe('qa --themes: un sistema que no declara el color de datos que el video pide', () => {
  it('reconoce el error de themes/data.ts (también envuelto por la página)', () => {
    const msg = 'Tema "neutral": no hay un color de datos "libre". No hay ninguno declarado. Se declaran en theme.data o con themeFromTokens.';
    expect(datoFaltante(new Error(msg))).toEqual({ theme: 'neutral', name: 'libre' });
    expect(datoFaltante(new Error(`page.evaluate: Error: ${msg}\n    at ...`))).toEqual({ theme: 'neutral', name: 'libre' });
    expect(datoFaltante(new Error('La pagina del video no arranco: Tema "dark": no hay un color de datos "estadoOk". Declarados: a, b. '))).toEqual({ theme: 'dark', name: 'estadoOk' });
  });
  it('cualquier otro error no se saltea', () => {
    expect(datoFaltante(new Error('Video desconocido "x"'))).toBeNull();
    expect(datoFaltante('algo'.repeat(3))).toBeNull();
  });
});
