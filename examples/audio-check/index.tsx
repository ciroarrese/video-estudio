import { Audio, Fill, Sequence, defineVideo } from '../../engine';

// Fixture for the audio registry: one root-level track and two nested ones. Nothing is fetched (Audio renders null).
// También sirve de prueba de `npm run audio -- informe|mezcla --video audio-check`: las escenas declaran sus sonidos (`cues`, en cuadros RELATIVOS a
// cada escena, derivados de la tabla de tiempos) y cuál lleva audio propio (`audioPropio`).
function AudioCheck() {
  return (
    <Fill style={{ background: '#222' }}>
      <Audio src="audio/root.wav" volume={0.8} />
      <Sequence from={30} durationInFrames={20}>
        <Audio src="audio/nested.wav" startFrom={5} />
        <Sequence from={10}>
          <Audio src="audio/deep.wav" />
        </Sequence>
      </Sequence>
    </Fill>
  );
}

// Tabla de tiempos de cada escena (cuadros relativos a su inicio): los cues salen de acá, así que si una escena cambia de lugar o de duración el sonido la sigue.
const T = {
  intro: { titulo: 0, lista: 12 },
  cuerpo: { clic: 4, tilde: 14 },
};

export default defineVideo({
  id: 'audio-check',
  component: AudioCheck,
  fps: 30,
  width: 320,
  height: 180,
  durationInFrames: 90,
  scenes: [
    { id: 'intro', from: 0, durationInFrames: 30, cues: [{ frame: T.intro.titulo, sfx: 'golpe' }, { frame: T.intro.lista, sfx: 'clic' }] },
    { id: 'cuerpo', from: 30, durationInFrames: 30, cues: [{ frame: T.cuerpo.clic, sfx: 'clic' }, { frame: T.cuerpo.tilde, sfx: 'tilde', ancla: 'pico' }] },
    { id: 'cierre', from: 60, durationInFrames: 30, audioPropio: true },
  ],
});
