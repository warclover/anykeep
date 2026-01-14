const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const workDir = 'c:/anykeep/workspace/ai-coding-2025';

// Create gradient background
async function createGradientBg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0f0c29"/>
        <stop offset="50%" style="stop-color:#302b63"/>
        <stop offset="100%" style="stop-color:#24243e"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, 'bg.png'));
  console.log('Background created');
}

// Create timeline dot icon
async function createDot(color, filename) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, filename));
}

// Create crown icon
async function createCrown() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
    <path fill="#ffd700" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(workDir, 'crown.png'));
}

async function createPresentation() {
  // Generate assets
  await createGradientBg();
  await createDot('#667eea', 'dot-blue.png');
  await createDot('#f093fb', 'dot-pink.png');
  await createDot('#4facfe', 'dot-cyan.png');
  await createCrown();

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = '2025年AI编程模型能力进化';
  pptx.author = 'AnyKeep';

  const slide = pptx.addSlide();

  // Background image
  slide.addImage({ path: path.join(workDir, 'bg.png'), x: 0, y: 0, w: 10, h: 5.625 });

  // Title bar background
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.7,
    fill: { color: '1a1a3e', transparency: 30 }
  });

  // Title
  slide.addText('2025年AI编程模型能力进化', {
    x: 0.3, y: 0.15, w: 9.4, h: 0.45,
    fontSize: 24, bold: true, color: 'FFFFFF',
    fontFace: 'Arial'
  });

  // Left section: Timeline
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.2, y: 0.85, w: 4.3, h: 4.0,
    fill: { color: '1a1a3e', transparency: 50 },
    line: { color: '667eea', width: 1 }
  });

  slide.addText('模型发布时间线', {
    x: 0.4, y: 0.95, w: 4, h: 0.35,
    fontSize: 14, bold: true, color: '667eea', fontFace: 'Arial'
  });

  // Timeline vertical line
  slide.addShape(pptx.shapes.LINE, {
    x: 0.7, y: 1.4, w: 0, h: 3.2,
    line: { color: '667eea', width: 2, dashType: 'dash' }
  });

  // Timeline items
  const timelineItems = [
    { date: '2025.5', text: 'Claude 4 发布', detail: 'SWE-bench 72.5%', color: 'f093fb' },
    { date: '2025.9', text: 'Claude Sonnet 4.5', detail: 'SWE-bench 77.2%', color: 'f093fb' },
    { date: '2025.11.18', text: 'Gemini 3 Pro', detail: 'SWE-bench 76.2% | Elo 1501', color: '4facfe' },
    { date: '2025.11.19', text: 'GPT-5.1 Codex-Max', detail: 'SWE-bench 77.9%', color: '00d9ff' },
    { date: '2025.11.24', text: 'Claude Opus 4.5', detail: 'SWE-bench 80.9%', color: 'ffd700', crown: true },
    { date: '2025.12', text: 'GPT-5.2', detail: 'SWE-bench 80.0%', color: '00d9ff' }
  ];

  let yPos = 1.4;
  const itemHeight = 0.52;

  timelineItems.forEach((item, i) => {
    // Dot
    slide.addShape(pptx.shapes.OVAL, {
      x: 0.58, y: yPos + 0.08, w: 0.18, h: 0.18,
      fill: { color: item.color },
      line: { color: 'FFFFFF', width: 1 }
    });

    // Date
    slide.addText(item.date, {
      x: 0.9, y: yPos, w: 0.9, h: 0.2,
      fontSize: 9, bold: true, color: item.color, fontFace: 'Arial'
    });

    // Model name
    const nameText = item.crown ? item.text + ' 👑' : item.text;
    slide.addText(nameText, {
      x: 0.9, y: yPos + 0.18, w: 2.2, h: 0.18,
      fontSize: 10, bold: true, color: 'FFFFFF', fontFace: 'Arial'
    });

    // Detail
    slide.addText(item.detail, {
      x: 0.9, y: yPos + 0.34, w: 3.4, h: 0.15,
      fontSize: 8, color: 'aaaaaa', fontFace: 'Arial'
    });

    yPos += itemHeight;
  });

  // Right top: Key capabilities
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 4.65, y: 0.85, w: 5.15, h: 1.65,
    fill: { color: '1a1a3e', transparency: 50 },
    line: { color: 'f093fb', width: 1 }
  });

  slide.addText('能力跃迁关键词', {
    x: 4.85, y: 0.95, w: 4.8, h: 0.3,
    fontSize: 14, bold: true, color: 'f093fb', fontFace: 'Arial'
  });

  const capabilities = [
    '从 Copilot 到 Agent 自主编程',
    '30+ 小时持续自主开发',
    '多模型协作工作流',
    '1M Token 超长上下文'
  ];

  capabilities.forEach((cap, i) => {
    slide.addText('▸ ' + cap, {
      x: 4.95, y: 1.3 + i * 0.27, w: 4.7, h: 0.25,
      fontSize: 11, color: 'FFFFFF', fontFace: 'Arial'
    });
  });

  // Right bottom: Comparison table
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 4.65, y: 2.65, w: 5.15, h: 2.2,
    fill: { color: '1a1a3e', transparency: 50 },
    line: { color: '4facfe', width: 1 }
  });

  slide.addText('各家特长对比', {
    x: 4.85, y: 2.75, w: 4.8, h: 0.3,
    fontSize: 14, bold: true, color: '4facfe', fontFace: 'Arial'
  });

  // Table
  const tableData = [
    [
      { text: '厂商', options: { fill: { color: '302b63' }, color: 'FFFFFF', bold: true, align: 'center' } },
      { text: '模型', options: { fill: { color: '302b63' }, color: 'FFFFFF', bold: true, align: 'center' } },
      { text: '特长', options: { fill: { color: '302b63' }, color: 'FFFFFF', bold: true, align: 'center' } }
    ],
    [
      { text: 'Anthropic', options: { color: 'f093fb', bold: true } },
      { text: 'Claude Opus 4.5', options: { color: 'FFFFFF' } },
      { text: 'Agent编排、长任务', options: { color: 'cccccc' } }
    ],
    [
      { text: 'OpenAI', options: { color: '00d9ff', bold: true } },
      { text: 'GPT-5.2 Codex', options: { color: 'FFFFFF' } },
      { text: '后端重构、终端操作', options: { color: 'cccccc' } }
    ],
    [
      { text: 'Google', options: { color: '4facfe', bold: true } },
      { text: 'Gemini 3 Pro', options: { color: 'FFFFFF' } },
      { text: '多模态、推理Elo最高', options: { color: 'cccccc' } }
    ]
  ];

  slide.addTable(tableData, {
    x: 4.85, y: 3.1, w: 4.75, h: 1.6,
    colW: [1.2, 1.7, 1.85],
    rowH: [0.35, 0.38, 0.38, 0.38],
    border: { pt: 0.5, color: '444466' },
    fill: { color: '1a1a3e' },
    fontSize: 10,
    fontFace: 'Arial',
    valign: 'middle'
  });

  // Footer
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.1, w: 10, h: 0.525,
    fill: { color: '0f0c29', transparency: 20 }
  });

  slide.addText('数据来源：SWE-bench Verified, LMArena, 各厂商官方发布 | 2025.12', {
    x: 0.3, y: 5.2, w: 9.4, h: 0.3,
    fontSize: 9, color: '888888', fontFace: 'Arial', align: 'center'
  });

  // Save
  const outputPath = path.join(workDir, 'ai-coding-2025.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log('PPT created:', outputPath);
}

createPresentation().catch(console.error);
