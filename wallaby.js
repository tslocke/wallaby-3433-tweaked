export default {
  resolveGetters: true,

  logLimits: {
    inline: {
      depth: 20,
    },
    values: {
      default: {
        stringLength: 3000,
      },
      autoExpand: {
        stringLength: 8192,
        elements: 5000,
        depth: 10,
      },
    },
  },

  runMode: "onSave",

  filesWithNoCoverageCalculated: [
    "tests/**",
    "src/client/books-temp/**",
    "src/client/dev.ts",
  ],
};
