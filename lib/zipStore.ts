/**
 * Minimal store-only (no compression) ZIP builder, isomorphic on purpose:
 * the server uses it when processing packages a recording's files, and the
 * browser uses it for the one-click backup zip on the recordings page
 * (founder 2026-09-07) - MP3s do not compress, so store-only loses nothing
 * and a dependency would buy nothing. ASCII/UTF-8 names, files under 4GB.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipStore(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  const u16 = (view: DataView, at: number, v: number) => view.setUint16(at, v, true);
  const u32 = (view: DataView, at: number, v: number) => view.setUint32(at, v, true);

  for (const e of entries) {
    const name = encoder.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); // local file header sig
    u16(lv, 4, 20); // version needed
    u16(lv, 6, 0x0800); // flags: UTF-8 names
    u16(lv, 8, 0); // method: store
    u16(lv, 10, 0); // mod time
    u16(lv, 12, 0x21); // mod date (1980-01-01)
    u32(lv, 14, crc);
    u32(lv, 18, size); // compressed size
    u32(lv, 22, size); // uncompressed size
    u16(lv, 26, name.length);
    u16(lv, 28, 0); // extra len
    chunks.push(local, name, e.data);

    const central = new Uint8Array(46);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50); // central dir sig
    u16(cv, 4, 20); // version made by
    u16(cv, 6, 20); // version needed
    u16(cv, 8, 0x0800); // flags
    u16(cv, 10, 0); // method
    u16(cv, 12, 0);
    u16(cv, 14, 0x21);
    u32(cv, 16, crc);
    u32(cv, 20, size);
    u32(cv, 24, size);
    u16(cv, 28, name.length);
    u16(cv, 30, 0); // extra
    u16(cv, 32, 0); // comment
    u16(cv, 34, 0); // disk
    u16(cv, 36, 0); // internal attrs
    u32(cv, 38, 0); // external attrs
    u32(cv, 42, offset); // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + e.data.length;
  }

  const centralStart = offset;
  const centralLen = centrals.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50); // end of central dir sig
  u16(ev, 8, entries.length); // entries this disk
  u16(ev, 10, entries.length); // total entries
  u32(ev, 12, centralLen); // central dir size
  u32(ev, 16, centralStart); // central dir offset

  const total = offset + centralLen + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of [...chunks, ...centrals, end]) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
