const pptxgen = require('pptxgenjs');
const path = require('path');

// 动态导入 html2pptx
async function createPresentation() {
    const html2pptx = require('c:/anykeep/.claude/skills/pptx/scripts/html2pptx');

    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'AnyKeep';
    pptx.title = '中国检验检测行业市场概况';
    pptx.subject = '2024年度市场分析报告';

    // 转换 HTML 为幻灯片
    const htmlPath = path.join(__dirname, 'china-testing-market.html');
    const { slide, placeholders } = await html2pptx(htmlPath, pptx);

    // 添加柱状图 - 核心产出指标
    if (placeholders.length > 0) {
        slide.addChart(pptx.charts.BAR, [{
            name: "2024年度",
            labels: ["营业收入\n(亿元)", "检测报告\n(亿份)"],
            values: [4876, 5.51 * 100]  // 报告数量放大100倍便于同图展示
        }], {
            ...placeholders[0],
            barDir: 'col',
            showTitle: false,
            showLegend: false,
            showValue: true,
            dataLabelPosition: 'outEnd',
            dataLabelFontSize: 11,
            dataLabelFontBold: true,
            dataLabelColor: '1A365D',
            // 坐标轴设置
            catAxisLabelColor: '4A5568',
            catAxisLabelFontSize: 9,
            catAxisLineShow: false,
            valAxisHidden: true,
            valAxisLineShow: false,
            valAxisMajorGridLine: { style: 'none' },
            // 颜色
            chartColors: ['2B6CB0', 'D69E2E'],
            // 圆角效果
            barGapWidthPct: 50
        });

        // 添加数据标签说明
        slide.addText([
            { text: '4,876', options: { bold: true, color: '2B6CB0' } },
            { text: ' 亿元', options: { color: '4A5568' } }
        ], {
            x: 5.05, y: 2.1, w: 1.5, h: 0.25,
            fontSize: 8, align: 'center'
        });

        slide.addText([
            { text: '5.51', options: { bold: true, color: 'D69E2E' } },
            { text: ' 亿份报告', options: { color: '4A5568' } }
        ], {
            x: 5.85, y: 2.1, w: 1.5, h: 0.25,
            fontSize: 8, align: 'center'
        });
    }

    // 保存文件
    const outputPath = path.join(__dirname, 'china-testing-market-2024.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log('PPT 创建成功:', outputPath);
}

createPresentation().catch(console.error);
