/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          main:    'var(--bg-main)',
          surface: 'var(--bg-surface)',
          card:    'var(--bg-card)',
          hover:   'var(--bg-hover)',
          sidebar: 'var(--bg-surface)',
          panel:   'var(--bg-card)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          disabled:  'var(--text-disabled)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dim:     'var(--accent-dim)',
          muted:   'var(--accent-bg)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--border-subtle)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          bg:      'var(--danger-bg)',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
