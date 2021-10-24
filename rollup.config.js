import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/mplaynet.ts',
    external: [],
    output: [
      {
        file: 'dist/mplaynet.esm.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/mplaynet.umd.js',
        format: 'umd',
        name: 'mplaynet',
        sourcemap: true,
        globals: {},
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  {
    input: 'src/deepstream/index.ts',
    external: ['@deepstream/client'],
    output: [
      {
        file: 'dist/mplaynet-deepstream.esm.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/mplaynet-deepstream.umd.js',
        format: 'umd',
        name: 'mplaynetDeepstream',
        sourcemap: true,
        globals: {
          '@deepstream/client': 'DeepstreamClient'
        },
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  {
    input: 'src/firebase/index.ts',
    external: ['firebase/compat/app'],
    output: [
      {
        file: 'dist/mplaynet-firebase.esm.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/mplaynet-firebase.umd.js',
        format: 'umd',
        name: 'mplaynetFirebase',
        sourcemap: true,
        globals: {
          'firebase/compat/app': 'firebase'
        },
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  }
];
