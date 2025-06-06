/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#242320',
        secondary: '#d16c0d',
        'gray-900': '#1a1a1a',
        'gray-800': '#2d2d2d',
        'gray-700': '#404040',
        'gray-600': '#525252',
        'gray-500': '#737373',
        'gray-400': '#a3a3a3',
        'gray-300': '#d4d4d4',
        'gray-200': '#e5e5e5',
        'gray-100': '#f5f5f5',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'waver': 'waver 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        waver: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05) rotate(1deg)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(209, 108, 13, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(209, 108, 13, 0.8)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}