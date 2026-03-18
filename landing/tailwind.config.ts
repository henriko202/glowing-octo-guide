import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#060B18',
          800: '#0C1425',
          600: '#131D30',
          400: '#1E2D45'
        },
        cream: {
          DEFAULT: '#F5F0E8',
          muted: '#A89F8C',
          dim: 'rgba(245,240,232,0.18)'
        },
        lnblue: {
          DEFAULT: '#0077B5',
          light: '#0A84FF'
        },
        gold: {
          DEFAULT: '#C9963E',
          light: '#E8B96A'
        }
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      keyframes: {
        slotRoll: {
          '0%, 20%': { transform: 'translateY(0)' },
          '28%, 48%': { transform: 'translateY(calc(-1 * var(--slot-h)))' },
          '56%, 76%': { transform: 'translateY(calc(-2 * var(--slot-h)))' },
          '84%, 96%': { transform: 'translateY(calc(-3 * var(--slot-h)))' },
          '100%': { transform: 'translateY(calc(-4 * var(--slot-h)))' }
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' }
        }
      },
      animation: {
        slotRoll: 'slotRoll 6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        fadeUp: 'fadeUp 0.7s ease forwards',
        shimmer: 'shimmer 3s linear infinite'
      }
    }
  }
}

export default config
