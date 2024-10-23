const defaultTheme = require('tailwindcss/defaultTheme')

// Colors from https://drupal.widencollective.com/portals/gfvztttq/BrandPortal
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js,mjs}"],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        drupal: {
          blue: "#009CDE",
          darkBlue: "#006AA9",
          navy: "#12285F",
          lightBlue: "#CCEDF9",
          purple: "#CCBAF4",
          yellow: "#FFC423",
          red: "#F46351",
          green: "#397618",
          white: "#FFFFFF",
          black: "#000000"
        }
      },
      backgroundImage: {
        'gradient-33-turn': 'linear-gradient(0.33turn, var(--tw-gradient-stops))'
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

