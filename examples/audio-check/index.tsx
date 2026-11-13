import { Audio, Fill, Sequence, defineVideo } from '../../engine';

// Fixture for the audio registry: one root-level track and two nested ones. Nothing is fetched (Audio renders null).
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

export default defineVideo({ id: 'audio-check', component: AudioCheck, fps: 30, width: 320, height: 180, durationInFrames: 90 });
