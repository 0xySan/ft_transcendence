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
        primary: "#1e40af", // bleu foncé
        secondary: "#9333ea", // violet
        accent: "#f59e0b" // orange
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
}
