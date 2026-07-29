import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      '.next-build/**',
      '.next-e2e/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      '*.tsbuildinfo',
    ],
  },
];

export default eslintConfig;
