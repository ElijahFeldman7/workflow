/** @type {import('tailwindcss').Config} */

// Theme tokens are defined as HSL triplets in index.css. This builds the
// color value for one of them, honoring Tailwind's opacity modifiers
// (bg-card/40) without the <alpha-value> placeholder string.
const token =
  (name) =>
  ({ opacityValue }) =>
    opacityValue === undefined
      ? `hsl(var(${name}))`
      : `hsl(var(${name}) / ${opacityValue})`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Every palette redefines the same variables, so these class names stay
      // valid across all of them.
      colors: {
        border: token("--border"),
        input: token("--input"),
        ring: token("--ring"),
        background: token("--background"),
        foreground: token("--foreground"),
        card: {
          DEFAULT: token("--card"),
          foreground: token("--card-foreground"),
        },
        popover: {
          DEFAULT: token("--popover"),
          foreground: token("--popover-foreground"),
        },
        primary: {
          DEFAULT: token("--primary"),
          foreground: token("--primary-foreground"),
        },
        secondary: {
          DEFAULT: token("--secondary"),
          foreground: token("--secondary-foreground"),
        },
        muted: {
          DEFAULT: token("--muted"),
          foreground: token("--muted-foreground"),
        },
        accent: {
          DEFAULT: token("--accent"),
          foreground: token("--accent-foreground"),
        },
        destructive: {
          DEFAULT: token("--destructive"),
          foreground: token("--destructive-foreground"),
        },
        success: token("--success"),
        warning: token("--warning"),
      },
    },
  },
  plugins: [],
};
