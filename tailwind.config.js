/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
      },
      colors: {
        paper: {
          50: "#f7f5ef",
        },
        ink: {
          900: "#1a1a1a",
          950: "#0f0f0f",
        },
        moss: {
          300: "#86c78a",
          400: "#6ab870",
          500: "#4da855",
        },
        gold: {
          300: "#f5d87a",
          400: "#f0c84a",
        },
      },
    },
  },
  plugins: [],
}