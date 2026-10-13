/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#000000',
          900: '#0a0a0a',
          850: '#101010',
          800: '#151515',
          700: '#1f1f1f',
          600: '#2a2a2a',
          500: '#3a3a3a',
        },
        bone: {
          DEFAULT: '#f5f5f4',
          muted: '#a3a3a3',
          dim: '#737373',
        },
        seed: {
          DEFAULT: '#e30613',
          600: '#c40510',
          700: '#9b040d',
          glow: 'rgba(227, 6, 19, 0.35)',
        },
      },
      fontFamily: {
        display: ['Michroma', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.35em',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};
