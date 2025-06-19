module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Module resolver for path aliases
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/services': './src/services',
            '@/types': './src/types',
            '@/constants': './src/constants',
            '@/utils': './src/utils',
            '@/hooks': './src/hooks',
          },
        },
      ],
    ],
  };
};