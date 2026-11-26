/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        clinic: {
          bg: 'var(--bg)',
          surf: 'var(--surf)',
          'surf-alt': 'var(--surf-alt)',
          ink: 'var(--ink)',
          'ink-light': 'var(--ink-light)',
          mut: 'var(--mut)',
          'mut-light': 'var(--mut-light)',
          teal: 'var(--teal)',
          'teal-dark': 'var(--teal-dark)',
          'teal-light': 'var(--teal-light)',
          'teal-subtle': 'var(--teal-subtle)',
          gold: 'var(--gold)',
          'gold-dark': 'var(--gold-dark)',
          'gold-glow': 'var(--gold-glow)',
          line: 'var(--line)',
          'line-strong': 'var(--line-strong)',
          accent: '#16b88b',
          danger: '#c94b4b',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Hind', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
