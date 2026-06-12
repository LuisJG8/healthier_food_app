/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7FAFB",
        ink: "#1F2629",
        muted: "#566164",
        line: "#D9E4E5",
        leaf: "#00696B",
        coral: "#16CBCD",
        berry: "#007A79",
        sky: "#DDF7EF",
        oat: "#EEF7F8",
      },
      boxShadow: {
        soft: "0 18px 42px rgba(0, 180, 184, 0.14)",
        inset: "inset 0 0 0 1px rgba(0, 105, 107, 0.12)",
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
