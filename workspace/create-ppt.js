const pptxgen = require('pptxgenjs');
const path = require('path');

// Get html2pptx from skill directory
const html2pptx = require('C:/anykeep/.claude/skills/pptx/scripts/html2pptx.js');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'AnyKeep';
    pptx.title = '2025年终汇报';
    pptx.subject = '年度工作总结';

    const slidesDir = 'C:/anykeep/workspace/slides';

    // Slide 1: Opening
    console.log('Creating slide 1...');
    await html2pptx(path.join(slidesDir, 'slide1.html'), pptx);

    // Slide 2: Principles
    console.log('Creating slide 2...');
    await html2pptx(path.join(slidesDir, 'slide2.html'), pptx);

    // Slide 3: Most Important Principle
    console.log('Creating slide 3...');
    await html2pptx(path.join(slidesDir, 'slide3.html'), pptx);

    // Slide 4: What We Did Right in 2025
    console.log('Creating slide 4...');
    await html2pptx(path.join(slidesDir, 'slide4.html'), pptx);

    // Save the presentation
    const outputPath = 'C:/anykeep/11-beautified.pptx';
    await pptx.writeFile({ fileName: outputPath });
    console.log(`Presentation saved to: ${outputPath}`);
}

createPresentation().catch(err => {
    console.error('Error creating presentation:', err);
    process.exit(1);
});
