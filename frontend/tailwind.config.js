/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#24201f",
        coral: "#e85d4a",
        cream: "#fffaf7",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 70px -32px rgba(90, 49, 39, 0.2)",
      },
    },
  },
  plugins: [],
};
