import type { Config } from "tailwindcss";

const colors = require("tailwindcss/colors");
const {
	default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

const config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
    			// Brand colors - Premium palette
    			'sauti-blue': '#186691',
    			'sauti-orange': '#FC8E00', 
    			'sauti-black': '#333333',
    			'sauti-footer': '#2C2C2C',
    			landing: '#EEF7F2',

          // Reference Image Palette
          'sauti-yellow': '#F5B017', // Solid
          'sauti-yellow-light': '#FEF9E1', // Pastel background
          
          'sauti-teal': '#068297', // Solid
          'sauti-teal-light': '#D7EBE9', // Pastel background
          
          'sauti-red': '#E85C4A', // Solid
          'sauti-red-light': '#FCE1DD', // Pastel background
          
          'sauti-dark': '#0B2228', // Rich Dark (Softened)
    			
    			// Premium design system colors
'primary': {
				DEFAULT: 'hsl(var(--primary))',
				foreground: 'hsl(var(--primary-foreground))',
				50: '#f0f9ff',
				100: '#e0f2fe', 
				200: '#bae6fd',
				300: '#7dd3fc',
				400: '#38bdf8',
				500: '#0ea5e9',
				600: '#0284c7',
				700: '#0369a1',
				800: '#075985',
				900: '#0c4a6e',
				950: '#082f49',
			},
'accent': {
				DEFAULT: 'hsl(var(--accent))',
				foreground: 'hsl(var(--accent-foreground))',
				50: '#fef7ed',
				100: '#fdedd5',
				200: '#fbd7aa',
				300: '#f8bc74',
				400: '#f59e0b',
				500: '#f97316',
				600: '#ea580c',
				700: '#c2410c',
				800: '#9a3412',
				900: '#7c2d12',
				950: '#431407',
			},
    			'neutral-warm': {
    				50: '#fafaf9',
    				100: '#f5f5f4',
    				200: '#e7e5e4', 
    				300: '#d6d3d1',
    				400: '#a8a29e',
    				500: '#78716c',
    				600: '#57534e',
    				700: '#44403c',
    				800: '#292524',
    				900: '#1c1917',
    				950: '#0c0a09',
    			},
    			'success': {
    				50: '#f0fdf4',
    				100: '#dcfce7',
    				200: '#bbf7d0',
    				300: '#86efac',
    				400: '#4ade80',
    				500: '#22c55e',
    				600: '#16a34a',
    				700: '#15803d',
    				800: '#166534',
    				900: '#14532d',
    				950: '#052e16',
    			},
    			'warning': {
    				50: '#fffbeb',
    				100: '#fef3c7',
    				200: '#fde68a',
    				300: '#fcd34d',
    				400: '#fbbf24',
    				500: '#f59e0b',
    				600: '#d97706',
    				700: '#b45309',
    				800: '#92400e',
    				900: '#78350f',
    				950: '#451a03',
    			},
    			'error': {
    				50: '#fef2f2',
    				100: '#fee2e2',
    				200: '#fecaca',
    				300: '#fca5a5',
    				400: '#f87171',
    				500: '#ef4444',
    				600: '#dc2626',
    				700: '#b91c1c',
    				800: '#991b1b',
    				900: '#7f1d1d',
    				950: '#450a0a',
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)',
    			// Extra premium rounded corners
    			'xl': '1rem',
    			'2xl': '1.5rem', // Default for cards
    			'3xl': '2rem',
          '4xl': '2.5rem',
          '5xl': '3rem',
    		},
    		// Premium spacing scale for consistent layouts
    		spacing: {
    			'safe-top': 'env(safe-area-inset-top)',
    			'safe-bottom': 'env(safe-area-inset-bottom)', 
    			'safe-left': 'env(safe-area-inset-left)',
    			'safe-right': 'env(safe-area-inset-right)',
    			'18': '4.5rem',
    			'22': '5.5rem',
    			'26': '6.5rem',
    			'30': '7.5rem',
    		},
    		// Typography scale for mobile-first PWA
    		fontSize: {
    			'2xs': ['0.625rem', { lineHeight: '0.75rem' }],
    			'xs': ['0.75rem', { lineHeight: '1rem' }],
    			'sm': ['0.875rem', { lineHeight: '1.25rem' }],
    			'base': ['1rem', { lineHeight: '1.5rem' }],
    			'lg': ['1.125rem', { lineHeight: '1.75rem' }],
    			'xl': ['1.25rem', { lineHeight: '1.75rem' }],
    			'2xl': ['1.5rem', { lineHeight: '2rem' }],
    			'3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    			'4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    			'5xl': ['3rem', { lineHeight: '1' }],
    			'6xl': ['3.75rem', { lineHeight: '1' }],
    			'7xl': ['4.5rem', { lineHeight: '1' }],
    			'8xl': ['6rem', { lineHeight: '1' }],
    			'9xl': ['8rem', { lineHeight: '1' }],
    		},
    		// Box shadows for premium feel
    		boxShadow: {
    			'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    			'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    			'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    			'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    			'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    			'2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    			'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    			'none': 'none',
    			// Premium custom shadows
    			'premium': '0 8px 32px 0 rgb(0 0 0 / 0.12)',
    			'card': '0 2px 8px 0 rgb(0 0 0 / 0.08)',
    			'navbar': '0 2px 16px 0 rgb(0 0 0 / 0.08)',
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			scroll: 'scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite',
    			// Premium PWA animations
    			'fade-in': 'fade-in 0.3s ease-out',
    			'fade-out': 'fade-out 0.2s ease-in',
    			'slide-up': 'slide-up 0.3s ease-out',
    			'slide-down': 'slide-down 0.3s ease-out',
    			'slide-left': 'slide-left 0.3s ease-out',
    			'slide-right': 'slide-right 0.3s ease-out',
    			'scale-in': 'scale-in 0.2s ease-out',
    			'scale-out': 'scale-out 0.15s ease-in',
    			'bounce-gentle': 'bounce-gentle 0.6s ease-out',
    			'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
    			'shimmer': 'shimmer 2s ease-in-out infinite alternate',
    			'float': 'float 3s ease-in-out infinite',
    			'press': 'press 0.1s ease-out',
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			scroll: {
    				to: {
    					transform: 'translate(calc(-50% - 0.5rem))'
    				}
    			},
    			// Premium PWA keyframes
    			'fade-in': {
    				'0%': { opacity: '0' },
    				'100%': { opacity: '1' }
    			},
    			'fade-out': {
    				'0%': { opacity: '1' },
    				'100%': { opacity: '0' }
    			},
    			'slide-up': {
    				'0%': { transform: 'translateY(100%)', opacity: '0' },
    				'100%': { transform: 'translateY(0)', opacity: '1' }
    			},
    			'slide-down': {
    				'0%': { transform: 'translateY(-100%)', opacity: '0' },
    				'100%': { transform: 'translateY(0)', opacity: '1' }
    			},
    			'slide-left': {
    				'0%': { transform: 'translateX(100%)', opacity: '0' },
    				'100%': { transform: 'translateX(0)', opacity: '1' }
    			},
    			'slide-right': {
    				'0%': { transform: 'translateX(-100%)', opacity: '0' },
    				'100%': { transform: 'translateX(0)', opacity: '1' }
    			},
    			'scale-in': {
    				'0%': { transform: 'scale(0.9)', opacity: '0' },
    				'100%': { transform: 'scale(1)', opacity: '1' }
    			},
    			'scale-out': {
    				'0%': { transform: 'scale(1)', opacity: '1' },
    				'100%': { transform: 'scale(0.9)', opacity: '0' }
    			},
    			'bounce-gentle': {
    				'0%, 100%': { transform: 'translateY(0)' },
    				'50%': { transform: 'translateY(-4px)' }
    			},
    			'pulse-subtle': {
    				'0%, 100%': { opacity: '1' },
    				'50%': { opacity: '0.8' }
    			},
    			'shimmer': {
    				'0%': { backgroundPosition: '-200px 0' },
    				'100%': { backgroundPosition: 'calc(200px + 100%) 0' }
    			},
    			'float': {
    				'0%, 100%': { transform: 'translateY(0px)' },
    				'50%': { transform: 'translateY(-6px)' }
    			},
    			'press': {
    				'0%': { transform: 'scale(1)' },
    				'50%': { transform: 'scale(0.95)' },
    				'100%': { transform: 'scale(1)' }
    			}
    		}
    	}
    },
	plugins: [require("tailwindcss-animate"), addVariablesForColors],
} satisfies Config;

function addVariablesForColors({ addBase, theme }: any) {
	let allColors = flattenColorPalette(theme("colors"));
	let newVars = Object.fromEntries(
		Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
	);

	addBase({
		":root": newVars,
	});
}

export default config;
