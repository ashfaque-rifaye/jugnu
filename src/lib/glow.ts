// Soft light, drawn once and reused: the same glow for the hero's fireflies and the map's schools.
export function glowSprite(rgb: string, size = 128, core = 0.16) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const f = g.createRadialGradient(r, r, 0, r, r, r);
  f.addColorStop(0, `rgb(${rgb} / 1)`);
  f.addColorStop(core, `rgb(${rgb} / 0.55)`);
  f.addColorStop(0.42, `rgb(${rgb} / 0.12)`);
  f.addColorStop(1, `rgb(${rgb} / 0)`);
  g.fillStyle = f;
  g.fillRect(0, 0, size, size);
  return c;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
