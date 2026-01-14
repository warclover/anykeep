const pptxgen = require('pptxgenjs');
const path = require('path');
const html2pptx = require('c:/anykeep/.claude/skills/pptx/scripts/html2pptx.js');

async function main() {
    console.log('Creating presentation...');
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'AnyKeep';
    pptx.title = '机器人大规模检测数据管理方案';

    const baseDir = 'c:/anykeep/workspace/robot-ppt';
    const slides = ['slide1.html', 'slide2.html', 'slide3.html', 'slide4.html', 'slide5.html', 'slide6.html'];

    for (let i = 0; i < slides.length; i++) {
        const slideFile = slides[i];
        const htmlPath = path.join(baseDir, slideFile);
        console.log(`Processing slide ${i + 1}: ${slideFile}`);
        await html2pptx(htmlPath, pptx);
        console.log(`  Slide ${i + 1} complete`);
    }

    const outputPath = path.join(baseDir, 'robot-detection-solution.pptx');
    console.log('Writing to:', outputPath);
    await pptx.writeFile({ fileName: outputPath });
    console.log('Presentation created successfully!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
