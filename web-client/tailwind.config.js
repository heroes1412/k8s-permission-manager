/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: '#0071e3',
          darkBlue: '#0066cc',
          brightBlue: '#2997ff',
          black: '#000000',
          nearBlack: '#1d1d1f',
          lightGray: '#f5f5f7',
          darkSurface1: '#272729',
          darkSurface2: '#262628',
          darkSurface3: '#28282a',
          darkSurface4: '#2a2a2d',
          darkSurface5: '#242426',
          buttonActive: '#ededf2',
          buttonLight: '#fafafc',
          textSecondaryLight: 'rgba(0, 0, 0, 0.8)',
          textTertiaryLight: 'rgba(0, 0, 0, 0.48)',
        }
      },
      fontFamily: {
        display: ['SF Pro Display', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        text: ['SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        apple: 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0px',
      },
      borderRadius: {
        pill: '980px',
      },
    },
  },
  plugins: [],
}
