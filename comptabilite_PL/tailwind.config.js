/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        // Semantic border radius
        'card': '1rem',
        'input': '0.75rem',
        'badge': '0.5rem',
      },
      colors: {
        // Primary palette
        primary: {
          50: 'hsl(217, 91%, 97%)',
          100: 'hsl(217, 91%, 95%)',
          200: 'hsl(217, 91%, 85%)',
          300: 'hsl(217, 91%, 75%)',
          400: 'hsl(217, 91%, 65%)',
          500: 'hsl(217, 91%, 60%)',
          600: 'hsl(217, 91%, 50%)',
          700: 'hsl(217, 91%, 40%)',
          800: 'hsl(217, 91%, 30%)',
          900: 'hsl(217, 91%, 20%)',
        },
        // Accent palette (orange)
        accent: {
          50: 'hsl(24, 95%, 97%)',
          100: 'hsl(24, 95%, 92%)',
          200: 'hsl(24, 95%, 80%)',
          300: 'hsl(24, 95%, 68%)',
          400: 'hsl(24, 95%, 58%)',
          500: 'hsl(24, 95%, 53%)',
          600: 'hsl(24, 95%, 45%)',
          700: 'hsl(24, 95%, 38%)',
        },
        // Success palette
        success: {
          50: 'hsl(142, 76%, 97%)',
          100: 'hsl(142, 76%, 95%)',
          200: 'hsl(142, 76%, 85%)',
          500: 'hsl(142, 76%, 45%)',
          600: 'hsl(142, 76%, 36%)',
          700: 'hsl(142, 76%, 28%)',
        },
        // Warning palette
        warning: {
          50: 'hsl(38, 92%, 97%)',
          100: 'hsl(38, 92%, 95%)',
          200: 'hsl(38, 92%, 85%)',
          500: 'hsl(38, 92%, 50%)',
          600: 'hsl(38, 92%, 42%)',
        },
        // Danger palette
        danger: {
          50: 'hsl(0, 84%, 97%)',
          100: 'hsl(0, 84%, 95%)',
          200: 'hsl(0, 84%, 85%)',
          500: 'hsl(0, 84%, 60%)',
          600: 'hsl(0, 84%, 50%)',
        },
        // Surface colors (backgrounds)
        surface: {
          DEFAULT: 'hsl(0, 0%, 100%)',
          secondary: 'hsl(220, 14%, 98%)',
          tertiary: 'hsl(220, 14%, 96%)',
        },
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.1)',
        'soft-xl': '0 8px 20px -4px rgba(0, 0, 0, 0.08), 0 16px 40px -8px rgba(0, 0, 0, 0.12)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.15)',
        // Semantic elevation shadows
        'elevation-1': '0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06)',
        'elevation-2': '0 4px 12px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.12)',
        'elevation-3': '0 8px 20px rgba(0, 0, 0, 0.12), 0 16px 40px rgba(0, 0, 0, 0.16)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
}
