/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // enabling dark mode for modern sleek appearance
  theme: {
    extend: {
      colors: {
        background: '#0F172A', // Sleek dark blue/black background
        surface: '#1E293B',    // Lighter surface for cards
        primary: '#3B82F6',    // Blue primary
        secondary: '#10B981',  // Emerald secondary
        accent: '#8B5CF6',     // Violet accent
        danger: '#EF4444',
        textMain: '#F8FAFC',
        textMuted: '#94A3B8'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
