const pptxgen = require('pptxgenjs');
const path = require('path');
const html2pptx = require('./html2pptx');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'AnyKeep';
    pptx.title = '机器人大规模检测数据管理方案';
    pptx.subject = '上海电子所杭州检测中心项目';

    const baseDir = 'c:/anykeep/workspace/robot-ppt';
    const slides = ['slide1.html', 'slide2.html', 'slide3.html', 'slide4.html', 'slide5.html', 'slide6.html'];

    for (const slideFile of slides) {
        const htmlPath = path.join(baseDir, slideFile);
        console.log(`Processing: ${slideFile}`);
        await html2pptx(htmlPath, pptx);
    }

    const outputPath = path.join(baseDir, 'robot-detection-solution.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log(`\nPresentation created: ${outputPath}`);
}

createPresentation().catch(console.error);
