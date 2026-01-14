const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const workDir = 'c:/anykeep/workspace/22-redesign';

// Ensure directory exists
if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

// Create gradient background
async function createGradientBg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8fafc"/>
        <stop offset="100%" style="stop-color:#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, 'bg.png'));
}

async function createPresentation() {
  await createGradientBg();

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = '客户分类矩阵分析';
  pptx.author = 'Professional Report';

  const slide = pptx.addSlide();

  // Background
  slide.addImage({ path: path.join(workDir, 'bg.png'), x: 0, y: 0, w: 10, h: 5.625 });

  // Title bar
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.65,
    fill: { color: '1e3a5f' }
  });

  slide.addText('客户分类矩阵分析', {
    x: 0.3, y: 0.15, w: 6, h: 0.4,
    fontSize: 22, bold: true, color: 'FFFFFF', fontFace: 'Arial'
  });

  slide.addText('基于数字化预算与场景成熟度的客户定位', {
    x: 6, y: 0.18, w: 3.7, h: 0.35,
    fontSize: 11, color: 'a0c4e8', fontFace: 'Arial', align: 'right'
  });

  // Matrix background
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.4, y: 0.85, w: 5.8, h: 4.2,
    fill: { color: 'FFFFFF' },
    shadow: { type: 'outer', blur: 8, offset: 2, angle: 45, color: '000000', opacity: 0.15 }
  });

  // Quadrant backgrounds
  // Q1 - 左上 (高预算/低成熟度) - 橙色系
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y: 0.95, w: 2.8, h: 2.0,
    fill: { color: 'fff7ed' },
    line: { color: 'fed7aa', width: 1 }
  });

  // Q2 - 右上 (高预算/高成熟度) - 绿色系
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 3.3, y: 0.95, w: 2.8, h: 2.0,
    fill: { color: 'f0fdf4' },
    line: { color: 'bbf7d0', width: 1 }
  });

  // Q3 - 左下 (低预算/低成熟度) - 灰色系
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y: 2.95, w: 2.8, h: 2.0,
    fill: { color: 'f8fafc' },
    line: { color: 'e2e8f0', width: 1 }
  });

  // Q4 - 右下 (低预算/高成熟度) - 蓝色系
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 3.3, y: 2.95, w: 2.8, h: 2.0,
    fill: { color: 'eff6ff' },
    line: { color: 'bfdbfe', width: 1 }
  });

  // Axes
  // Y-axis (数字化预算)
  slide.addShape(pptx.shapes.LINE, {
    x: 0.5, y: 0.95, w: 0, h: 4.0,
    line: { color: '475569', width: 2.5 }
  });
  // Y-axis arrow
  slide.addText('▲', {
    x: 0.35, y: 0.75, w: 0.3, h: 0.25,
    fontSize: 12, color: '475569', fontFace: 'Arial'
  });

  // X-axis (场景成熟度)
  slide.addShape(pptx.shapes.LINE, {
    x: 0.5, y: 4.95, w: 5.7, h: 0,
    line: { color: '475569', width: 2.5 }
  });
  // X-axis arrow
  slide.addText('▶', {
    x: 6.1, y: 4.82, w: 0.3, h: 0.25,
    fontSize: 12, color: '475569', fontFace: 'Arial'
  });

  // Axis labels
  slide.addText([
    { text: '数', options: { breakLine: true } },
    { text: '字', options: { breakLine: true } },
    { text: '化', options: { breakLine: true } },
    { text: '预', options: { breakLine: true } },
    { text: '算' }
  ], {
    x: 0.08, y: 2.2, w: 0.35, h: 1.8,
    fontSize: 11, bold: true, color: '334155', fontFace: 'Arial', align: 'center'
  });

  slide.addText('场景成熟度（可复用性）', {
    x: 1.8, y: 5.05, w: 3, h: 0.3,
    fontSize: 11, bold: true, color: '334155', fontFace: 'Arial', align: 'center'
  });

  // High/Low labels
  slide.addText('高', {
    x: 0.15, y: 1.1, w: 0.3, h: 0.25,
    fontSize: 10, color: '64748b', fontFace: 'Arial'
  });
  slide.addText('低', {
    x: 0.15, y: 4.5, w: 0.3, h: 0.25,
    fontSize: 10, color: '64748b', fontFace: 'Arial'
  });
  slide.addText('低', {
    x: 0.6, y: 5.05, w: 0.3, h: 0.25,
    fontSize: 10, color: '64748b', fontFace: 'Arial'
  });
  slide.addText('高', {
    x: 5.8, y: 5.05, w: 0.3, h: 0.25,
    fontSize: 10, color: '64748b', fontFace: 'Arial'
  });

  // Quadrant titles
  slide.addText('项目定制型', {
    x: 0.6, y: 1.0, w: 2.6, h: 0.28,
    fontSize: 12, bold: true, color: 'c2410c', fontFace: 'Arial'
  });

  slide.addText('产品潜力型 ⭐', {
    x: 3.4, y: 1.0, w: 2.6, h: 0.28,
    fontSize: 12, bold: true, color: '15803d', fontFace: 'Arial'
  });

  slide.addText('传统保守型', {
    x: 0.6, y: 3.0, w: 2.6, h: 0.28,
    fontSize: 12, bold: true, color: '64748b', fontFace: 'Arial'
  });

  slide.addText('效率优先型', {
    x: 3.4, y: 3.0, w: 2.6, h: 0.28,
    fontSize: 12, bold: true, color: '1d4ed8', fontFace: 'Arial'
  });

  // Customer dots and labels - Q1 (项目定制型)
  const q1Customers = [
    { name: '浦镇', x: 1.0, y: 1.45 },
    { name: '商飞', x: 1.6, y: 1.75 },
    { name: '南网', x: 2.2, y: 1.5 }
  ];

  q1Customers.forEach(c => {
    slide.addShape(pptx.shapes.OVAL, {
      x: c.x, y: c.y, w: 0.18, h: 0.18,
      fill: { color: 'ea580c' },
      line: { color: 'FFFFFF', width: 2 }
    });
    slide.addText(c.name, {
      x: c.x - 0.15, y: c.y + 0.2, w: 0.6, h: 0.22,
      fontSize: 9, bold: true, color: 'c2410c', fontFace: 'Arial', align: 'center'
    });
  });

  // Q2 (产品潜力型)
  const q2Customers = [
    { name: '赛宝', x: 5.0, y: 1.35 },
    { name: '华测', x: 4.4, y: 1.8 },
    { name: '信测', x: 3.8, y: 2.2 }
  ];

  q2Customers.forEach(c => {
    slide.addShape(pptx.shapes.OVAL, {
      x: c.x, y: c.y, w: 0.18, h: 0.18,
      fill: { color: '16a34a' },
      line: { color: 'FFFFFF', width: 2 }
    });
    slide.addText(c.name, {
      x: c.x - 0.15, y: c.y + 0.2, w: 0.6, h: 0.22,
      fontSize: 9, bold: true, color: '15803d', fontFace: 'Arial', align: 'center'
    });
  });

  // Q3 (传统保守型)
  const q3Customers = [
    { name: '中汽研', x: 1.5, y: 3.4 },
    { name: '北测', x: 0.9, y: 4.0 }
  ];

  q3Customers.forEach(c => {
    slide.addShape(pptx.shapes.OVAL, {
      x: c.x, y: c.y, w: 0.18, h: 0.18,
      fill: { color: '94a3b8' },
      line: { color: 'FFFFFF', width: 2 }
    });
    slide.addText(c.name, {
      x: c.x - 0.25, y: c.y + 0.2, w: 0.8, h: 0.22,
      fontSize: 9, bold: true, color: '64748b', fontFace: 'Arial', align: 'center'
    });
  });

  // Q4 (效率优先型) - 新华
  slide.addShape(pptx.shapes.OVAL, {
    x: 4.0, y: 3.5, w: 0.18, h: 0.18,
    fill: { color: '2563eb' },
    line: { color: 'FFFFFF', width: 2 }
  });
  slide.addText('新华', {
    x: 3.85, y: 3.72, w: 0.6, h: 0.22,
    fontSize: 9, bold: true, color: '1d4ed8', fontFace: 'Arial', align: 'center'
  });

  // Right side - Analysis cards
  // Card 1: 产品潜力型 (推荐)
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 6.4, y: 0.85, w: 3.4, h: 1.35,
    fill: { color: 'dcfce7' },
    line: { color: '16a34a', width: 2 }
  });

  slide.addText('⭐ 最适合做产品的客户', {
    x: 6.55, y: 0.92, w: 3.1, h: 0.28,
    fontSize: 11, bold: true, color: '15803d', fontFace: 'Arial'
  });

  slide.addText([
    { text: '特点：', options: { bold: true } },
    { text: '业务量大 + 数字化需求旺盛', options: {} }
  ], {
    x: 6.55, y: 1.22, w: 3.1, h: 0.22,
    fontSize: 9, color: '166534', fontFace: 'Arial'
  });

  slide.addText('⚠ 但客户已实现产品自研', {
    x: 6.55, y: 1.45, w: 3.1, h: 0.22,
    fontSize: 9, color: 'b45309', fontFace: 'Arial'
  });

  slide.addText('策略：提供增值服务与深度集成', {
    x: 6.55, y: 1.72, w: 3.1, h: 0.22,
    fontSize: 9, bold: true, color: '15803d', fontFace: 'Arial'
  });

  // Card 2: 项目定制型
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 6.4, y: 2.3, w: 3.4, h: 1.35,
    fill: { color: 'ffedd5' },
    line: { color: 'ea580c', width: 1.5 }
  });

  slide.addText('项目形式的客户', {
    x: 6.55, y: 2.37, w: 3.1, h: 0.28,
    fontSize: 11, bold: true, color: 'c2410c', fontFace: 'Arial'
  });

  slide.addText([
    { text: '特点：', options: { bold: true } },
    { text: '高度定制 + 高成本 + 高预算', options: {} }
  ], {
    x: 6.55, y: 2.67, w: 3.1, h: 0.22,
    fontSize: 9, color: '9a3412', fontFace: 'Arial'
  });

  slide.addText('缺乏整建制IT能力，需驻场服务', {
    x: 6.55, y: 2.9, w: 3.1, h: 0.22,
    fontSize: 9, color: '9a3412', fontFace: 'Arial'
  });

  slide.addText('策略：提供全流程服务方案', {
    x: 6.55, y: 3.17, w: 3.1, h: 0.22,
    fontSize: 9, bold: true, color: 'c2410c', fontFace: 'Arial'
  });

  // Card 3: 传统保守型
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 6.4, y: 3.75, w: 3.4, h: 1.35,
    fill: { color: 'f1f5f9' },
    line: { color: '94a3b8', width: 1.5 }
  });

  slide.addText('传统保守型客户', {
    x: 6.55, y: 3.82, w: 3.1, h: 0.28,
    fontSize: 11, bold: true, color: '475569', fontFace: 'Arial'
  });

  slide.addText([
    { text: '特点：', options: { bold: true } },
    { text: '对数字化系统不敏感', options: {} }
  ], {
    x: 6.55, y: 4.12, w: 3.1, h: 0.22,
    fontSize: 9, color: '64748b', fontFace: 'Arial'
  });

  slide.addText('对投入成本极度敏感，习惯人力解决', {
    x: 6.55, y: 4.35, w: 3.1, h: 0.22,
    fontSize: 9, color: '64748b', fontFace: 'Arial'
  });

  slide.addText('策略：轻量化低成本入门方案', {
    x: 6.55, y: 4.62, w: 3.1, h: 0.22,
    fontSize: 9, bold: true, color: '475569', fontFace: 'Arial'
  });

  // Footer
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.35, w: 10, h: 0.275,
    fill: { color: '1e3a5f' }
  });

  slide.addText('客户战略分析 | 数字化转型服务定位', {
    x: 0.3, y: 5.38, w: 9.4, h: 0.22,
    fontSize: 8, color: 'a0c4e8', fontFace: 'Arial', align: 'center'
  });

  // Save
  const outputPath = path.join(workDir, '22-redesigned.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log('PPT created:', outputPath);
}

createPresentation().catch(console.error);
