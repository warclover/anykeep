import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // 包含常量文件，确保动态类名被扫描
    "./src/lib/constants/**/*.ts",
  ],
  // 确保颜色选择器按钮样式被编译（动态类名）
  safelist: [
    "bg-blue-400",
    "bg-purple-400",
    "bg-pink-400",
    "bg-sky-400",
    "bg-lime-400",
    "bg-yellow-400",
    "bg-slate-400",
    "bg-zinc-400",
    // 侧边栏糖果色 - 我的内容（粉红色）
    "bg-pink-50",
    "bg-pink-100",
    "bg-pink-900/20",
    "bg-pink-900/30",
    "text-pink-500",
    "text-pink-700",
    "text-pink-300",
    "text-pink-400",
    // 侧边栏糖果色 - 洞察与通知（天蓝色）
    "bg-cyan-50",
    "bg-cyan-100",
    "bg-cyan-900/20",
    "bg-cyan-900/30",
    "text-cyan-500",
    "text-cyan-700",
    "text-cyan-300",
    "text-cyan-400",
    // 侧边栏糖果色 - 智能工具（紫色）
    "bg-purple-50",
    "bg-purple-100",
    "bg-purple-900/20",
    "bg-purple-900/30",
    "text-purple-600",
    "text-purple-700",
    "text-purple-300",
    "text-purple-400",
    // 侧边栏糖果色 - 洞察中心（玫瑰色，备用）
    "bg-rose-50",
    "bg-rose-100",
    "bg-rose-900/20",
    "bg-rose-900/30",
    "text-rose-600",
    "text-rose-700",
    "text-rose-300",
    "text-rose-400",
    // 侧边栏糖果色 - 开发者工具（石板灰）
    "bg-slate-100",
    "bg-slate-200",
    "bg-slate-800/30",
    "bg-slate-800/50",
    "text-slate-600",
    "text-slate-700",
    "text-slate-300",
    "text-slate-400",
    // 侧边栏分组竖条指示器（动态背景色）
    "bg-pink-500",
    "bg-purple-500",
    "bg-cyan-400",
    "bg-cyan-500",
    "bg-gray-400",
    "bg-gray-500",
    "bg-slate-500",
    // 粉色主题渐变色
    "from-pink-400",
    "to-rose-500",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // 自定义缓动函数，避免 ease-[cubic-bezier(...)] 警告
      transitionTimingFunction: {
        // Material Design 标准缓动
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        // Drawer 组件专用缓动（更平滑的弹出效果）
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      // 中文字体栈 - 确保 Tailwind 组件使用正确的中文优化字体
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "'PingFang SC'",
          "'Hiragino Sans GB'",
          "'Microsoft YaHei'",
          "'Helvetica Neue'",
          "'Noto Sans CJK SC'",
          "'Source Han Sans SC'",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
