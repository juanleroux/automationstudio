/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          main: '#1c1c1c',
          sidebar: '#242424',
          panel: '#2a2a2a',
          card: '#303030',
          hover: '#383838'
        },
        accent: {
          DEFAULT: '#3ecf8e',
          hover: '#2db87a',
          muted: 'rgba(62,207,142,0.15)'
        },
        border: {
          DEFAULT: '#333333',
          light: '#3d3d3d'
        },
        text: {
          primary: '#ededed',
          secondary: '#9e9e9e',
          muted: '#666666'
        },
        danger: {
          DEFAULT: '#e55353',
          hover: '#cc4444'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
