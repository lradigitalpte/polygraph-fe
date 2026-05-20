// React Theme — extracted from https://www.tebra.com/
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    neutral50: string;
    neutral100: string;
    neutral200: string;
    neutral300: string;
    neutral400: string;
    neutral500: string;
    neutral600: string;
    neutral700: string;
    neutral800: string;
    neutral900: string;
 *   };
 *   fonts: {
    body: string;
    mono: string;
 *   };
 *   fontSizes: {
    '16': string;
    '18': string;
    '21': string;
    '22': string;
    '24': string;
    '36': string;
    '48': string;
    '50': string;
    '60': string;
    '68': string;
    '26.32': string;
    '15.82': string;
 *   };
 *   space: {
    '1': string;
    '15': string;
    '30': string;
    '35': string;
    '40': string;
    '47': string;
    '52': string;
    '56': string;
    '64': string;
    '78': string;
    '103': string;
    '107': string;
    '116': string;
    '136': string;
    '145': string;
    '180': string;
 *   };
 *   radii: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
 *   };
 *   shadows: {
    xs: string;
    md: string;
    lg: string;
    xl: string;
 *   };
 *   states: {
 *     hover: { opacity: number };
 *     focus: { opacity: number };
 *     active: { opacity: number };
 *     disabled: { opacity: number };
 *   };
 * }
 */

export const theme = {
  "colors": {
    "primary": "#ff8d6e",
    "secondary": "#004952",
    "accent": "#3860be",
    "background": "#ffffff",
    "foreground": "#000000",
    "neutral50": "#000000",
    "neutral100": "#232323",
    "neutral200": "#ffffff",
    "neutral300": "#555555",
    "neutral400": "#dcdcdc",
    "neutral500": "#8ca7a2",
    "neutral600": "#696969",
    "neutral700": "#000a0c",
    "neutral800": "#c5d6d7",
    "neutral900": "#767676"
  },
  "fonts": {
    "body": "'Arial', sans-serif",
    "mono": "'__AkkuratMonoLL_c826bb', monospace"
  },
  "fontSizes": {
    "16": "16px",
    "18": "18px",
    "21": "21px",
    "22": "22px",
    "24": "24px",
    "36": "36px",
    "48": "48px",
    "50": "50px",
    "60": "60px",
    "68": "68px",
    "26.32": "26.32px",
    "15.82": "15.82px"
  },
  "space": {
    "1": "1px",
    "15": "15px",
    "30": "30px",
    "35": "35px",
    "40": "40px",
    "47": "47px",
    "52": "52px",
    "56": "56px",
    "64": "64px",
    "78": "78px",
    "103": "103px",
    "107": "107px",
    "116": "116px",
    "136": "136px",
    "145": "145px",
    "180": "180px"
  },
  "radii": {
    "xs": "1px",
    "sm": "4px",
    "md": "10px",
    "lg": "16px",
    "xl": "24px",
    "full": "100px"
  },
  "shadows": {
    "xs": "rgb(220, 220, 220) 0px -1px 0px 0px inset",
    "md": "rgba(0, 0, 0, 0.15) 0px 5px 10px 0px",
    "lg": "rgba(0, 0, 0, 0.1) 0px 10.1px 10.1px -5.05px, rgba(0, 0, 0, 0.04) 0px 20.2px 25.25px -5.05px",
    "xl": "rgba(0, 0, 0, 0.07) -2.47px 4.94px 60.28px 0px"
  },
  "states": {
    "hover": {
      "opacity": 0.08
    },
    "focus": {
      "opacity": 0.12
    },
    "active": {
      "opacity": 0.16
    },
    "disabled": {
      "opacity": 0.38
    }
  }
};

// MUI v5 theme
export const muiTheme = {
  "palette": {
    "primary": {
      "main": "#ff8d6e",
      "light": "hsl(13, 100%, 87%)",
      "dark": "hsl(13, 100%, 57%)"
    },
    "secondary": {
      "main": "#004952",
      "light": "hsl(187, 100%, 31%)",
      "dark": "hsl(187, 100%, 10%)"
    },
    "background": {
      "default": "#ffffff",
      "paper": "#004952"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#003a43"
    }
  },
  "typography": {
    "fontFamily": "'__Lora_e96844', sans-serif",
    "h1": {
      "fontSize": "36px",
      "fontWeight": "400",
      "lineHeight": "43.2px"
    },
    "h2": {
      "fontSize": "26.32px",
      "fontWeight": "700",
      "lineHeight": "36.848px"
    }
  },
  "shape": {
    "borderRadius": 7
  },
  "shadows": [
    "rgb(220, 220, 220) 0px -1px 0px 0px inset",
    "rgb(199, 197, 199) -3px -3px 5px -2px",
    "rgb(153, 153, 153) 0px 2px 10px -3px",
    "rgb(199, 197, 199) 0px 0px 12px 2px",
    "rgba(0, 0, 0, 0.2) 0px 4px 8px 0px"
  ]
};

export default theme;
