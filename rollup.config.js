import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/mplaynet.ts',
  external: ['@deepstream/client'],
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
      },
    },
  ],
  plugins: [typescript()],
};
