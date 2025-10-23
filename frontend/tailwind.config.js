// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.{html,js}", // toutes les pages HTML
    "./src/**/*.{js,ts,jsx,tsx}" // tes scripts (si tu ajoutes du TS/JS)
  ],
  theme: {
    extend: {
      colors: {
        rosewater: "rgb(var(--rosewater) / <alpha-value>)",
        flamingo: "rgb(var(--flamingo) / <alpha-value>)",
        pink: "rgb(var(--pink) / <alpha-value>)",
        mauve: "rgb(var(--mauve) / <alpha-value>)",
        red: "rgb(var(--red) / <alpha-value>)",
        maroon: "rgb(var(--maroon) / <alpha-value>)",
        peach: "rgb(var(--peach) / <alpha-value>)",
        yellow: "rgb(var(--yellow) / <alpha-value>)",
        green: "rgb(var(--green) / <alpha-value>)",
        teal: "rgb(var(--teal) / <alpha-value>)",
        sky: "rgb(var(--sky) / <alpha-value>)",
        sapphire: "rgb(var(--sapphire) / <alpha-value>)",
        blue: "rgb(var(--blue) / <alpha-value>)",
        lavender: "rgb(var(--lavender) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        subtext1: "rgb(var(--subtext1) / <alpha-value>)",
        subtext0: "rgb(var(--subtext0) / <alpha-value>)",
        overlay2: "rgb(var(--overlay2) / <alpha-value>)",
        overlay1: "rgb(var(--overlay1) / <alpha-value>)",
        overlay0: "rgb(var(--overlay0) / <alpha-value>)",
        base: "rgb(var(--base) / <alpha-value>)",
        mantle: "rgb(var(--mantle) / <alpha-value>)",
        crust: "rgb(var(--crust) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
}
