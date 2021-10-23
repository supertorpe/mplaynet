import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
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
        globals: {
        },
      },
    ],
    plugins: [typescript({ sourceMap: true })],
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
        globals: {
          '@deepstream/client': 'DeepstreamClient'
        },
      },
    ],
    plugins: [typescript({ sourceMap: true })],
  },
  {
    input: 'src/firebase/index.ts',
    external: ['firebase/app'],
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
        globals: {
          'firebase/app': 'firebase'
        },
      },
    ],
    plugins: [typescript({ sourceMap: true })],
  }
];
