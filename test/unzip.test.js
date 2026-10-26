const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { unzip } = require('../public/admin/unzip');

// builds a small deflated zip in memory, the way a slicer writes a .3mf
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameB = Buffer.from(name);
    const data = zlib.deflateRawSync(Buffer.from(text));
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(Buffer.byteLength(text), 22); lh.writeUInt16LE(nameB.length, 26);
    locals.push(lh, nameB, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(Buffer.byteLength(text), 24); ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test('reads only the wanted entries of a 3mf and inflates them', async () => {
  const zip = makeZip({
    '3D/3dmodel.model': '<model/>',
    'Metadata/slice_info.config': '<metadata key="prediction" value="5520"/><metadata key="weight" value="12.34"/>',
    'Metadata/plate_1.gcode': '; total filament used [g] = 12.3\n',
  });
  const got = await unzip(zip, n => n === 'Metadata/slice_info.config' || n.endsWith('.gcode'));
  assert.deepEqual(Object.keys(got).sort(), ['Metadata/plate_1.gcode', 'Metadata/slice_info.config']);
  assert.match(new TextDecoder().decode(got['Metadata/slice_info.config']), /key="prediction" value="5520"/);
});

test('rejects a file that is not a zip', async () => {
  await assert.rejects(unzip(new Uint8Array(100), () => true), /no es un .3mf/);
});
