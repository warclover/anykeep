import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# 数据
years = [2021, 2022, 2023, 2024, 2025]
sales = [0.00, 717628.31, 1095061.95, 2506707.96, 3883006.67]

# 创建图表
fig, ax = plt.subplots(figsize=(10, 6))

# 绘制柱状图
bars = ax.bar(years, sales, color=['#e0e0e0', '#4CAF50', '#2196F3', '#FF9800', '#F44336'],
              edgecolor='white', linewidth=1.5)

# 绘制折线图（趋势线）
ax.plot(years, sales, marker='o', color='#1a237e', linewidth=2, markersize=8, zorder=5)

# 添加数据标签
for bar, sale in zip(bars, sales):
    height = bar.get_height()
    ax.annotate(f'{sale:,.0f}',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 8),
                textcoords="offset points",
                ha='center', va='bottom',
                fontsize=10, fontweight='bold')

# 设置标题和标签
ax.set_title('Annual Sales Trend (2021-2025)', fontsize=16, fontweight='bold', pad=20)
ax.set_xlabel('Year', fontsize=12)
ax.set_ylabel('Sales (CNY)', fontsize=12)

# 设置 Y 轴格式
ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'{x/10000:.0f}W'))

# 设置 X 轴刻度
ax.set_xticks(years)

# 添加网格线
ax.yaxis.grid(True, linestyle='--', alpha=0.7)
ax.set_axisbelow(True)

# 设置背景色
ax.set_facecolor('#fafafa')

# 调整布局
plt.tight_layout()

# 保存图片
plt.savefig('c:/anykeep/sales_chart.png', dpi=150, bbox_inches='tight', facecolor='white')
print('Chart saved to: c:/anykeep/sales_chart.png')
