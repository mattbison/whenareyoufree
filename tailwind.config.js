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
        // Brand teal. `accent-ink` is the darker shade for teal text on white.
        accent: { DEFAULT: rgb("accent"), ink: rgb("accent-ink") },
        // Availability states: "you" = your own free time, "some" = others,
        // "free" = everyone (shares the brand teal), "busy" = blocked.
        you: rgb("you"),
        some: rgb("some"),
        free: { DEFAULT: rgb("accent"), ink: rgb("accent-ink") },
        busy: { DEFAULT: rgb("busy"), ink: rgb("busy-ink") },
        hairline: "var(--hairline)",
        overlay: { DEFAULT: "var(--overlay)", strong: "var(--overlay-strong)" },
      },
      borderRadius: {
        card: "24px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
      },
      fontFamily: {
        sans: [
          "Figtree",
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
