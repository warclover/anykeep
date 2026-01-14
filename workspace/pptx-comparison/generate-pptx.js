const pptxgen = require('pptxgenjs');
const path = require('path');

// html2pptx.js 的路径
const html2pptx = require(path.join(__dirname, '../../.claude/skills/pptx/scripts/html2pptx.js'));

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Sales Team';
    pptx.title = '硬件设备与LIMS软件销售核心差异对比';
    pptx.subject = '销售培训材料';

    const slides = [
        'slide1-cover.html',
        'slide2-demand.html',
        'slide3-decision.html',
        'slide4-value.html',
        'slide5-priority.html',
        'slide6-service.html',
        'slide7-cost.html'
    ];

    for (const slideFile of slides) {
        const htmlPath = path.join(__dirname, slideFile);
        await html2pptx(htmlPath, pptx);
    }

    const outputPath = path.join(__dirname, 'hardware-vs-lims-comparison.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log('PPT created:', outputPath);
}

createPresentation().catch(console.error);
