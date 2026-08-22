/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neon AI-music-app palette — deep near-black base with electric
        // purple/pink/cyan accents, the same visual language Suno/Udio/
        // ElevenLabs use, instead of the earlier warm analog-console look.
        bg: "#0A0A12",        // near-black, slight indigo tint
        surface: "#141220",   // panel
        panel: "#1B1830",     // channel strip
        primary: "#B24BFF",   // electric purple/magenta — main accent
        accent: "#00E5FF",    // electric cyan — "live" states, secondary accent
        alert: "#FF3B5C",     // neon red — errors only
        paper: "#F4F1FF",     // primary text (very light violet-white)
        muted: "#9490B8",     // secondary text, cool violet-gray
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(178, 75, 255, 0.35), 0 0 4px rgba(178, 75, 255, 0.6)",
        "glow-cyan": "0 0 20px rgba(0, 229, 255, 0.35), 0 0 4px rgba(0, 229, 255, 0.6)",
      },
      backgroundImage: {
        "neon-gradient": "linear-gradient(135deg, #FF3EC9 0%, #B24BFF 50%, #00E5FF 100%)",
      },
    },
  },
  plugins: [],
};
