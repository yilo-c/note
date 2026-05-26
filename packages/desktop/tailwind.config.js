/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        acrylic: { 900: 'rgba(18,18,26,0.75)', 800: 'rgba(22,22,32,0.7)', 700: 'rgba(28,28,40,0.65)' },
        fluent: { blue: '#60a5fa', red: '#f87171', green: '#34d399', yellow: '#fbbf24', purple: '#a78bfa', orange: '#fb923c', pink: '#f472b6' },
      },
      fontFamily: { sans: ['"Segoe UI"', '"Noto Sans SC"', 'system-ui', 'sans-serif'] },
      boxShadow: {
        'acrylic': '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
        'acrylic-lg': '0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
        'fluent': '0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      backdropBlur: { acrylic: '20px' },
    },
  },
  plugins: [],
}
