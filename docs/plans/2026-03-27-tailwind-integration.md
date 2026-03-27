# Tailwind CSS Integration Plan

The goal is to move from inline styles to Tailwind CSS for better maintainability and consistent styling across the
`app` package.

## Steps

1. **Dependencies**: Install `tailwindcss`, `postcss`, and `autoprefixer` in the `app` directory.
2. **Configuration**: Create `tailwind.config.js` and `postcss.config.js` in the `app` directory.
3. **Directives**: Create `src/index.css` with `@tailwind` directives.
4. **Entry Point**: Import `src/index.css` in `src/main.tsx`.
5. **Refactoring**: Replace all `style={{ ... }}` attributes with `className="..."` across all components and pages in
   the `app`.
6. **Verification**: Ensure the app builds correctly and styles are applied as expected.

## Implementation Details

- All inline styles have been converted to the closest Tailwind utility classes.
- Common Slate-based color scheme was used to match the existing design tokens (e.g., `#0f172a` -> `slate-900`,
  `#64748b` -> `slate-500`).
- Spacing followed the standard Tailwind 4px-base (e.g., `padding: 32` -> `p-8`).
- Responsive grid layouts were maintained using Tailwind's grid utilities.

## Status: Completed (2026-03-27)
