/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        'sidebar-bg': 'var(--color-sidebar-bg)',
        card: 'var(--color-card)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        'input-border': 'var(--color-input-border)',
        dropdown: 'var(--color-dropdown)',
        hover: 'var(--color-hover)',
        accent: '#10a37f',
        'accent-2': '#19c37d',
        muted: 'var(--color-muted)',
        text: 'var(--color-text)',
        'text-sub': 'var(--color-text-sub)',
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', '"Pretendard"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
