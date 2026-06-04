/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF5DD",
        ink: "#0D530E",
        muted: "#306D29",
        line: "#E7E1B1",
        leaf: "#306D29",
        coral: "#E7E1B1",
        berry: "#0D530E",
        sky: "#E7E1B1",
        oat: "#FBF5DD",
      },
      boxShadow: {
        soft: "0 14px 30px rgba(13, 83, 14, 0.14)",
        inset: "inset 0 0 0 1px rgba(48, 109, 41, 0.14)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
