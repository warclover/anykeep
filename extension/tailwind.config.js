/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/popup/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // AnyKeep 品牌色
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // 状态色
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      spacing: {
        // Popup 尺寸
        'popup-w': '360px',
        'popup-h': '480px',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
