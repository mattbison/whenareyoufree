/** @type {import('tailwindcss').Config} */

// Colors are CSS variables defined in src/styles.css, so light/dark is a
// single token swap instead of a `dark:` override on every element.
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: rgb("canvas"),
        surface: rgb("surface"),
        ink: rgb("ink"),
        muted: rgb("muted"),
        accent: rgb("accent"),
        // Availability states. "free" = everyone, "some" = others, "busy" = blocked.
        free: { DEFAULT: rgb("free"), ink: rgb("free-ink") },
        some: rgb("some"),
        busy: { DEFAULT: rgb("busy"), ink: rgb("busy-ink") },
        hairline: "var(--hairline)",
        overlay: { DEFAULT: "var(--overlay)", strong: "var(--overlay-strong)" },
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
      },
      fontFamily: {
        sans: [
          "Inter",
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
