// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#5c1600",
        primaryHover: "#471100", // mais escuro

        secondary: "#eac6ab",
        secondaryHover: "#e0b596", // tom mais forte

        tertiary: "#3a1e2c",
        tertiaryHover: "#2b1621", // mais escuro

        quaternary: "#f2e6dd",
        quaternaryHover: "#e4d2c6", // mais forte

        textColorPrimary: "#5c1600",
        textColorPrimaryHover: "#471100",

        bgLight: "#f9f8f7",
        bgLightHover: "#eceae8", // levemente mais escuro

        bgCardsKanban: "#f1ece7",
        bgCardsKanbanHover: "#e3dbd4", // mais forte
      }
    },
  },
  plugins: [],
}