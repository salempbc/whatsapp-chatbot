export default {
  darkMode: "class",
  content: ["./web/index.html", "./web/src/**/*.{vue,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
      },
      colors: {
        brand: { 50: "#eef2ff", 100: "#e0e7ff", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
        gold: { 400: "#e6b84a", 500: "#d4a73a" },
        canvas: { DEFAULT: "#f5f6fb", dark: "#0a0e16" },
        surface: { DEFAULT: "#ffffff", dark: "#111827", 2: "#182033" },
        slate: {
          50: "#f6f7fb", 100: "#eceff6", 200: "#dfe3ee", 300: "#c3cadb", 400: "#8e98b0",
          500: "#646f8a", 600: "#4a546e", 700: "#343c52", 800: "#222a3d", 900: "#151b2a", 950: "#0a0e16"
        }
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        sm: "0 1px 2px rgba(16,24,40,.05), 0 2px 6px rgba(16,24,40,.05)",
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -8px rgba(16,24,40,.12)",
        glow: "0 8px 24px -6px rgba(99,102,241,.55)"
      },
      keyframes: {
        tabIn: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } }
      },
      animation: { "tab-in": "tabIn .28s cubic-bezier(.2,.8,.2,1)" }
    }
  }
};
