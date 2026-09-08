/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050508",        // Pure Pitch Black
        surface: "#0D0D14",   // Deep Obsidian Card
        panel: "#14141F",     // Sleek Studio Console Strip
        primary: "#BD00FF",   // Electric Neon Magenta Accent
        accent: "#00F2FE",    // Electric Neon Cyan Accent
        neon: "#BD00FF",      // Electric Neon Magenta
        amber: "#FFAB00",     // Warm Studio Amber
        alert: "#FF3B30",     // Bright Red Alert
        paper: "#FFFFFF",     // Pure Crisp White
        muted: "#8E8EA8",     // Sleek Slate Gray
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(189, 0, 255, 0.35), 0 0 5px rgba(189, 0, 255, 0.7)",
        "glow-cyan": "0 0 25px rgba(0, 242, 254, 0.4), 0 0 5px rgba(0, 242, 254, 0.8)",
        amberGlow: "0 0 25px rgba(255, 171, 0, 0.4)",
        glass: "0 10px 40px 0 rgba(0, 0, 0, 0.8)",
      },
      backgroundImage: {
        "neon-gradient": "linear-gradient(135deg, #00F2FE 0%, #BD00FF 50%, #FF3EC9 100%)",
        "accent-gradient": "linear-gradient(135deg, #00F2FE 0%, #BD00FF 100%)",
      },
    },
  },
  plugins: [],
};
