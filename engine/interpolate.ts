import type { EasingFn } from './Easing';

export type InterpolateOptions = {
  easing?: EasingFn;
  /** Clamp to the output range outside the input range. Default true. */
  clamp?: boolean;
};

export function interpolate(
  frame: number,
  input: number[],
  output: number[],
  opts: InterpolateOptions = {},
): number {
  if (!Number.isFinite(frame)) {
    throw new Error(`interpolate: frame must be a finite number (got ${frame})`);
  }
  if (input.length !== output.length) {
    throw new Error(
      `interpolate: input and output must have the same length (got ${input.length} and ${output.length})`,
    );
  }
  if (input.length < 2) {
    throw new Error('interpolate: at least 2 keyframes are required');
  }
  for (let i = 0; i < input.length; i++) {
    if (!Number.isFinite(input[i]!) || !Number.isFinite(output[i]!)) {
      throw new Error(`interpolate: keyframe ${i} must be a finite number`);
    }
    if (i > 0 && input[i]! <= input[i - 1]!) {
      throw new Error(
        `interpolate: input must be strictly increasing (input[${i - 1}]=${input[i - 1]}, input[${i}]=${input[i]})`,
      );
    }
  }
  const clamp = opts.clamp ?? true;
  const last = input.length - 1;

  let seg: number;
  if (frame <= input[0]!) {
    if (clamp) return output[0]!;
    seg = 0;
  } else if (frame >= input[last]!) {
    if (clamp) return output[last]!;
    seg = last - 1;
  } else {
    seg = 0;
    while (frame > input[seg + 1]!) seg++;
  }

  const t = (frame - input[seg]!) / (input[seg + 1]! - input[seg]!);
  // Easing only inside [0,1]; extrapolation (clamp: false) stays linear.
  const e = opts.easing && t >= 0 && t <= 1 ? opts.easing(t) : t;
  return output[seg]! + (output[seg + 1]! - output[seg]!) * e;
}
