import type { CSSProperties, ReactNode } from 'react';

export function Fill({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...style }}>{children}</div>
  );
}
