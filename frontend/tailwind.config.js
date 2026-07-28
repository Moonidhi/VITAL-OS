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
      keyframes: {
        dashflow: {
          to: { strokeDashoffset: '-40' },
        },
        pulsedot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        dashflow: 'dashflow 1.2s linear infinite',
        pulsedot: 'pulsedot 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
