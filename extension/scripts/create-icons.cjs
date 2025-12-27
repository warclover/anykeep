/**
 * 创建扩展占位图标
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 计算
function crc32(buf) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 创建简单的 PNG 图像
function createPNG(size) {
  const chunks = [];

  // PNG Signature
  chunks.push(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 2;   // color type (RGB)
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace

  const ihdrType = Buffer.from('IHDR');
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(Buffer.concat([ihdrType, ihdrData])), 0);

  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  chunks.push(ihdrLen, ihdrType, ihdrData, ihdrCrc);

  // IDAT chunk (图像数据)
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte per row
    for (let x = 0; x < size; x++) {
      // AnyKeep 主色: #0ea5e9 = rgb(14, 165, 233)
      rawData.push(14, 165, 233);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  const idatType = Buffer.from('IDAT');
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(Buffer.concat([idatType, compressed])), 0);

  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  chunks.push(idatLen, idatType, compressed, idatCrc);

  // IEND chunk
  const iendType = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendType), 0);
  chunks.push(Buffer.from([0, 0, 0, 0]), iendType, iendCrc);

  return Buffer.concat(chunks);
}

// 主函数
function main() {
  const iconsDir = path.join(__dirname, '..', 'public', 'assets', 'icons');

  console.log('Creating icons directory:', iconsDir);
  fs.mkdirSync(iconsDir, { recursive: true });

  const sizes = [16, 32, 48, 128];

  sizes.forEach(size => {
    const png = createPNG(size);
    const filePath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Created: ${filePath} (${png.length} bytes)`);
  });

  console.log('Done!');
}

main();
