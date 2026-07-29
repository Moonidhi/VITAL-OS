/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#0B0F14',
          surface: '#131922',
          elevated: '#1A2230',
          border: '#252E3D',
        },
        text: {
          primary: '#E8EDF4',
          muted: '#8B95A7',
          faint: '#5A6478',
        },
        solar: '#F5A623',
        wind: '#4DD0C4',
        battery: '#7C9EFF',
        gridok: '#3DD68C',
        gridout: '#FF5C5C',
        critical: '#FF7849',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, #131922 0px, transparent 50%), radial-gradient(at 80% 0%, #0d1520 0px, transparent 50%), radial-gradient(at 0% 50%, #0B0F14 0px, transparent 50%)',
        'solar-glow': 'radial-gradient(circle, #F5A62320 0%, transparent 70%)',
        'battery-glow': 'radial-gradient(circle, #7C9EFF20 0%, transparent 70%)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      keyframes: {
        dashflow: {
          to: { strokeDashoffset: '-40' },
        },
        pulsedot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(124, 158, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(124, 158, 255, 0.6), 0 0 40px rgba(124, 158, 255, 0.2)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'number-flip': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        dashflow: 'dashflow 1.2s linear infinite',
        pulsedot: 'pulsedot 1.8s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-in-up': 'slide-in-up 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
