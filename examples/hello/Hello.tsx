import { Easing, Fill, Series, interpolate, useFrame, useVideoConfig } from '../../engine';

function Dot({ color }: { color: string }) {
  const frame = useFrame();
  const { width, height } = useVideoConfig();
  const x = interpolate(frame, [0, 44], [160, width - 160], { easing: Easing.inOut });
  const y = height / 2 + interpolate(frame, [0, 22, 44], [0, -120, 0], { easing: Easing.out });
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 60,
        top: y - 60,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}

function Title({ text }: { text: string }) {
  const frame = useFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 72,
        color: '#1b1f2a',
        opacity,
      }}
    >
      {text}
    </div>
  );
}

export function Hello() {
  return (
    <Fill style={{ background: '#f4f1ea' }}>
      <Series>
        <Series.Item durationInFrames={45}>
          <Title text="Hello" />
          <Dot color="#e4572e" />
        </Series.Item>
        <Series.Item durationInFrames={45}>
          <Title text="World" />
          <Dot color="#2e86e4" />
        </Series.Item>
      </Series>
    </Fill>
  );
}
