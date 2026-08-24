import * as zlib from 'zlib';

// ─── PlantUML server-side encoding ────────────────────────────────────────────

function plantumlEncode(text: string): string {
  const deflated = zlib.deflateRawSync(Buffer.from(text, 'utf-8'), { level: 9 });
  return encode64(deflated);
}

function encode64(data: Buffer): string {
  let r = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;
    r += append3bytes(b1, b2, b3);
  }
  return r;
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

export function getPlantUMLUrl(pumlCode: string): string {
  return 'https://www.plantuml.com/plantuml/svg/' + plantumlEncode(pumlCode);
}
