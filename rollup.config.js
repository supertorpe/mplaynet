import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/mplaynet.ts',
  external: ['@deepstream/client','firebase/app'],
  output: [
    {
      file: 'dist/mplaynet.esm.js',
      format: 'es',
    },
    {
      file: 'dist/mplaynet.umd.js',
      format: 'umd',
      name: 'mplaynet',
      globals: {
        '@deepstream/client': 'DeepstreamClient',
        'firebase/app': 'firebase'
      },
    },
  ],
  plugins: [typescript()],
};
