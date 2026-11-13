import { Easing, Fill, Series, interpolate, useFormat, useFrame } from '../../engine';

function Dot({ color }: { color: string }) {
  const frame = useFrame();
  // `useFormat` da el formato y el tamaño del escenario; `pick` elige el valor para cada formato.
  const { width, height, pick } = useFormat();
  const size = pick({ horizontal: 120, vertical: 100 });
  const margin = pick({ horizontal: 160, vertical: 360 });
  const vertical = pick({ horizontal: false, vertical: true });
  // En vertical el punto sube y baja a lo largo del alto; en horizontal y cuadrado cruza el ancho.
  const along = interpolate(frame, [0, 44], [margin, (vertical ? height : width) - margin], { easing: Easing.inOut });
  const across = (vertical ? width : height) / 2 + interpolate(frame, [0, 22, 44], [0, -120 * (size / 120), 0], { easing: Easing.out });
  const x = vertical ? across : along;
  const y = vertical ? along : across;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}

function Title({ text }: { text: string }) {
  const frame = useFrame();
  const { pick } = useFormat();
  const opacity = interpolate(frame, [0, 12], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top: pick({ horizontal: 80, vertical: 140, cuadrado: 60 }),
        width: '100%',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: pick({ horizontal: 72, vertical: 84, cuadrado: 64 }),
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
