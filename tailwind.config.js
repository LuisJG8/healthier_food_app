/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f1fafb",
        ink: "#15174d",
        muted: "#3d4670",
        line: "#c9eaf1",
        leaf: "#4a4de7",
        coral: "#7ea6f4",
        berry: "#292ba3",
        sky: "#a0e4f1",
        oat: "#dff5f8",
      },
      boxShadow: {
        soft: "0 14px 30px rgba(74, 77, 231, 0.12)",
        inset: "inset 0 0 0 1px rgba(74, 77, 231, 0.1)",
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
