/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        subtle: 'var(--subtle)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        surface: 'var(--surface)',
        'surface-strong': 'var(--surface-strong)',
        'surface-muted': 'var(--surface-muted)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        focus: 'var(--focus)',
        ok: 'var(--success)',
        bad: 'var(--danger)',
        caution: '#8a5a00',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
