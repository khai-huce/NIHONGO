/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: { relative: true, files: ['./apps/{web,admin}/index.html', './apps/{web,admin}/src/**/*.{js,ts,jsx,tsx}', './packages/client/src/**/*.{js,ts,jsx,tsx}'] },
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        primary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
          dark: '#2563eb'
        },
        border: 'hsl(var(--border))',
        jlpt: {
          n5: '#10b981',
          n4: '#0ea5e9',
          n3: '#f59e0b',
          n2: '#f97316',
          n1: '#ef4444',
          radical: '#8b5cf6'
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Inter"', 'sans-serif'],
        japanese: ['"Zen Maru Gothic"', '"UD Digi Kyokasho"', '"Noto Sans JP"', 'sans-serif'],
      },
      boxShadow: {
        'cute': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1)'
      }
    },
  },
  plugins: [],
}
