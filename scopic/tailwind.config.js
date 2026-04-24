/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/renderer/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#C9A55C",
          light: "#D4B675",
          dark: "#A8874A",
        },
        dark: {
          DEFAULT: "#0F1117",
          secondary: "#161B27",
          tertiary: "#1E2535",
          border: "#2A3347",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        serif: ["DM Serif Display", "serif"],
      },
    },
  },
  plugins: [],
};
