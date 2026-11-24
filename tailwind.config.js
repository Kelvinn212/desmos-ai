/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        desmos: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        math: ['"Times New Roman"', 'Symbola', 'Times', 'serif'],
      },
      colors: {
        desmos: {
          header: '#2b2b2b',
          headerBorder: '#1d1d1d',
          blue: '#2d70b3',
          saveBlue: '#2f72dc',
          focusBlue: '#4d88cc',
          red: '#c74440',
          green: '#388c46',
          purple: '#6042a6',
          orange: '#fa7e19',
          sidebarToolbar: '#f5f5f5',
          gutter: '#ededed',
          border: '#d5d5d5',
        },
      },
    },
  },
  plugins: [],
};
