/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
    colors: {
        primary: {
            '50': 'hsl(NaN, NaN%, 97%)',
            '100': 'hsl(NaN, NaN%, 94%)',
            '200': 'hsl(NaN, NaN%, 86%)',
            '300': 'hsl(NaN, NaN%, 76%)',
            '400': 'hsl(NaN, NaN%, 64%)',
            '500': 'hsl(NaN, NaN%, 50%)',
            '600': 'hsl(NaN, NaN%, 40%)',
            '700': 'hsl(NaN, NaN%, 32%)',
            '800': 'hsl(NaN, NaN%, 24%)',
            '900': 'hsl(NaN, NaN%, 16%)',
            '950': 'hsl(NaN, NaN%, 10%)',
            DEFAULT: '#ff8d6e'
        },
        secondary: {
            '50': 'hsl(NaN, NaN%, 97%)',
            '100': 'hsl(NaN, NaN%, 94%)',
            '200': 'hsl(NaN, NaN%, 86%)',
            '300': 'hsl(NaN, NaN%, 76%)',
            '400': 'hsl(NaN, NaN%, 64%)',
            '500': 'hsl(NaN, NaN%, 50%)',
            '600': 'hsl(NaN, NaN%, 40%)',
            '700': 'hsl(NaN, NaN%, 32%)',
            '800': 'hsl(NaN, NaN%, 24%)',
            '900': 'hsl(NaN, NaN%, 16%)',
            '950': 'hsl(NaN, NaN%, 10%)',
            DEFAULT: '#004952'
        },
        accent: {
            '50': 'hsl(NaN, NaN%, 97%)',
            '100': 'hsl(NaN, NaN%, 94%)',
            '200': 'hsl(NaN, NaN%, 86%)',
            '300': 'hsl(NaN, NaN%, 76%)',
            '400': 'hsl(NaN, NaN%, 64%)',
            '500': 'hsl(NaN, NaN%, 50%)',
            '600': 'hsl(NaN, NaN%, 40%)',
            '700': 'hsl(NaN, NaN%, 32%)',
            '800': 'hsl(NaN, NaN%, 24%)',
            '900': 'hsl(NaN, NaN%, 16%)',
            '950': 'hsl(NaN, NaN%, 10%)',
            DEFAULT: '#3860be'
        },
        'neutral-50': '#000000',
        'neutral-100': '#232323',
        'neutral-200': '#ffffff',
        'neutral-300': '#555555',
        'neutral-400': '#dcdcdc',
        'neutral-500': '#8ca7a2',
        'neutral-600': '#696969',
        'neutral-700': '#000a0c',
        'neutral-800': '#c5d6d7',
        'neutral-900': '#767676',
        background: '#ffffff',
        foreground: '#000000'
    },
    fontFamily: {
        sans: [
            '__AkkuratLL_8dc0fd',
            'sans-serif'
        ],
        body: [
            '__AkkuratMonoLL_c826bb',
            'sans-serif'
        ]
    },
    fontSize: {
        '14': [
            '14px',
            {
                lineHeight: '20px'
            }
        ],
        '16': [
            '16px',
            {
                lineHeight: '18.4px'
            }
        ],
        '18': [
            '18px',
            {
                lineHeight: '29px'
            }
        ],
        '21': [
            '21px',
            {
                lineHeight: '24px'
            }
        ],
        '22': [
            '22px',
            {
                lineHeight: '26.4px',
                letterSpacing: '-0.44px'
            }
        ],
        '24': [
            '24px',
            {
                lineHeight: '34px'
            }
        ],
        '36': [
            '36px',
            {
                lineHeight: '43.2px',
                letterSpacing: '-0.72px'
            }
        ],
        '48': [
            '48px',
            {
                lineHeight: '57.6px',
                letterSpacing: '-1.44px'
            }
        ],
        '50': [
            '50px',
            {
                lineHeight: 'normal'
            }
        ],
        '60': [
            '60px',
            {
                lineHeight: '72px',
                letterSpacing: '-2.4px'
            }
        ],
        '68': [
            '68px',
            {
                lineHeight: '81.6px',
                letterSpacing: '-2.72px'
            }
        ],
        '26.32': [
            '26.32px',
            {
                lineHeight: '36.848px'
            }
        ],
        '15.82': [
            '15.82px',
            {
                lineHeight: '24.521px'
            }
        ],
        '15.3': [
            '15.3px',
            {
                lineHeight: 'normal'
            }
        ],
        '14.4': [
            '14.4px',
            {
                lineHeight: '14.4px',
                letterSpacing: '0.144px'
            }
        ]
    },
    spacing: {
        '15': '30px',
        '20': '40px',
        '26': '52px',
        '28': '56px',
        '32': '64px',
        '39': '78px',
        '58': '116px',
        '68': '136px',
        '90': '180px',
        '92': '184px',
        '134': '268px',
        '154': '308px',
        '237': '474px',
        '1px': '1px',
        '15px': '15px',
        '35px': '35px',
        '47px': '47px',
        '103px': '103px',
        '107px': '107px',
        '145px': '145px',
        '199px': '199px'
    },
    borderRadius: {
        xs: '1px',
        sm: '4px',
        md: '10px',
        lg: '16px',
        xl: '24px',
        full: '100px'
    },
    boxShadow: {
        xs: 'rgb(220, 220, 220) 0px -1px 0px 0px inset',
        md: 'rgba(0, 0, 0, 0.15) 0px 5px 10px 0px',
        lg: 'rgba(0, 0, 0, 0.1) 0px 10.1px 10.1px -5.05px, rgba(0, 0, 0, 0.04) 0px 20.2px 25.25px -5.05px',
        xl: 'rgba(0, 0, 0, 0.07) -2.47px 4.94px 60.28px 0px'
    },
    screens: {
        '400px': '400px',
        sm: '426px',
        '550px': '550px',
        md: '768px',
        lg: '1040px',
        '1141px': '1141px',
        '2280px': '2280px'
    },
    transitionDuration: {
        '100': '0.1s',
        '150': '0.15s',
        '200': '0.2s',
        '250': '0.25s',
        '300': '0.3s',
        '330': '0.33s',
        '350': '0.35s',
        '400': '0.4s',
        '600': '0.6s',
        '700': '0.7s',
        '800': '0.8s',
        '900': '0.9s'
    },
    transitionTimingFunction: {
        linear: 'linear',
        default: 'ease',
        custom: 'cubic-bezier(0.8, 0, 0.2, 1)'
    },
    container: {
        center: true,
        padding: '20px'
    },
    maxWidth: {
        container: '1440px'
    }
},
  },
};
