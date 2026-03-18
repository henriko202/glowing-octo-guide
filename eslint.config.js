// eslint.config.js — root flat config for the entire monorepo
// Applies to: app/ (Vite+React), convex/ (Node+TS), landing/ (Next.js+React)

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // ─── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/_generated/**',
      'convex-mocks/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs'
    ]
  },

  // ─── Base JS rules for all files ──────────────────────────────────────────
  js.configs.recommended,

  // ─── TypeScript rules (all .ts / .tsx files) ──────────────────────────────
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Convex handlers use `_` prefix for unused ctx/args
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // ─── Test files — relax strictness for mocks ──────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__mocks__/**', '**/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // ─── React rules (app/ and landing/) ─────────────────────────────────────
  {
    files: ['app/src/**/*.{ts,tsx}', 'landing/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // With React 17+ new JSX transform, no need to import React in scope
      'react/react-in-jsx-scope': 'off',
      // Prop types are superseded by TypeScript
      'react/prop-types': 'off',
      // English contractions in JSX are fine — too noisy to enforce escaping
      'react/no-unescaped-entities': 'off'
    }
  },

  // ─── Convex backend — console logging is intentional in server functions ──
  {
    files: ['convex/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  },

  // ─── Prettier — must be last; disables all formatting rules ───────────────
  prettierConfig
)
