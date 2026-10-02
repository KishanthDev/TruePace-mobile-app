/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: "#050505",
          card: "#121212",
          border: "#1f1f1f",
          accent: "#22c55e",
          warning: "#eab308",
          danger: "#ef4444",
          muted: "#71717a",
          highlight: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
