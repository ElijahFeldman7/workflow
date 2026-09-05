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
      fontFamily: {
        sans: [
          '"DM Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
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
