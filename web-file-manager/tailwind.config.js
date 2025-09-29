
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1976d2',
        secondary: '#ff9800',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
        background: '#f5f5f5',
        surface: '#ffffff',
        'on-primary': '#ffffff',
        'on-secondary': '#000000',
        'on-surface': '#000000',
      },
      fontFamily: {
        sans: ['Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
