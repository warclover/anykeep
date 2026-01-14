const pptxgen = require('pptxgenjs');
const html2pptx = require('c:/anykeep/.claude/skills/pptx/scripts/html2pptx.js');
const path = require('path');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = '电脑通科技';
    pptx.title = '向量化数据处理';
    pptx.subject = '核心能力介绍';

    // Convert HTML to PowerPoint slide
    const htmlFile = path.resolve('C:/anykeep/workspace/robot-sales-ppt/5_beautify/slide5.html');
    console.log('Converting HTML file:', htmlFile);

    try {
        const { slide } = await html2pptx(htmlFile, pptx);
        console.log('Slide created successfully');

        // Save the presentation
        const outputPath = 'C:/anykeep/workspace/robot-sales-ppt/5_beautified.pptx';
        await pptx.writeFile({ fileName: outputPath });
        console.log('Presentation saved to:', outputPath);
    } catch (error) {
        console.error('Error creating presentation:', error.message);
        throw error;
    }
}

createPresentation().catch(console.error);
