/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        wechat: '#07C160',
        bilibili: '#FB7299',
        xiaohongshu: '#FF2442',
      },
    },
  },
  plugins: [],
}
