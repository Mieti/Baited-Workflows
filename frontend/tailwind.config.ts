import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#121314",
        panel: "#1b1c1e",
        panel2: "#222326",
        line: "#303236",
        baited: {
          green: "#25d57c",
          coral: "#ff6b57",
          ink: "#e8eaed"
        }
      },
      boxShadow: {
        node: "0 14px 40px rgba(0,0,0,0.32)"
      }
    }
  },
  plugins: []
};

export default config;
