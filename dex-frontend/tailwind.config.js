/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#00C9FF", dark: "#0099CC", light: "#33D4FF" },
        accent: { DEFAULT: "#92FE9D", dark: "#6FD97A" },
        surface: { DEFAULT: "#0f172a", card: "#1e293b", hover: "#334155" },
        positive: "#22c55e",
        negative: "#ef4444",
      },
    },
  },
  plugins: [],
};
