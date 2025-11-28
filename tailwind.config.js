/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bluebite-primary': '#0066FF',
        'bluebite-dark': '#003DB3',
        'bluebite-light': '#4D99FF',
      },
    },
  },
  plugins: [],
}
