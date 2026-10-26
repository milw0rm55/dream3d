/**
 * Minimal zip reader for .3mf files. Works in the browser and in Node (test/unzip.test.js).
 * shortcut: no zip64 and no encryption, so archives over 4 GB or with a password are not read
 */
(function (root) {
  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // returns { entryName: Uint8Array } for the entries that `wanted(name)` accepts
  async function unzip(bytes, wanted) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El archivo no es un .3mf (zip) válido');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Índice del zip dañado');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const xlen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!wanted(name)) continue;
      // the local header has its own name and extra lengths, which can differ from the central directory's
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = bytes.subarray(start, start + csize);
      out[name] = method === 0 ? data : await inflateRaw(data);
    }
    return out;
  }

  const Zip = { unzip };
  if (typeof module !== 'undefined' && module.exports) module.exports = Zip;
  else root.Zip = Zip;
})(this);
