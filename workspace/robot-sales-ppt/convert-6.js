const html2pptx = require('c:/anykeep/.claude/skills/pptx/scripts/html2pptx.js');
const PptxGenJS = require('pptxgenjs');
const path = require('path');

async function main() {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
  pptx.layout = 'CUSTOM';

  const htmlPath = path.join(__dirname, 'slides', '6-reasons.html');
  console.log('Converting slide: 6-reasons.html');
  await html2pptx(htmlPath, pptx);

  const outputPath = path.join(__dirname, '6-beautified.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log(`\nPPTX saved to: ${outputPath}`);
}

main().catch(console.error);
