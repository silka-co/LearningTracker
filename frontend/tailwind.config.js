/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'sans-serif'],
        serif: ['Zodiak', 'Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        zinc: {
          900: '#10100E',
        },
        brand: {
          DEFAULT: '#10100E',
          hover: '#27272A',
          muted: '#3F3F46',
          accent: '#7C3AED',
          'accent-light': '#8B5CF6',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
