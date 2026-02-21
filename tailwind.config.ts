import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        phoenixGreen: "#183536",
        phoenixCopper: "#B46A3C",
        phoenixOffWhite: "#F7F6F3",
        phoenixInk: "#0E1A1A",
      },
    },
  },
  plugins: [],
};

export default config;
