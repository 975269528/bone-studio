/* global module */
/** Package only the built editor, desktop bridge and production dependencies. */
module.exports = {
  appId: 'org.bonestudio.editor',
  productName: 'BoneStudio',
  asar: true,
  directories: { output: 'release' },
  files: ['dist/**', 'dist-mcp/**', 'electron/**', 'package.json'],
  win: {
    target: [{ target: 'portable', arch: ['x64'] }],
    signExecutable: false,
  },
  portable: {
    artifactName: 'BoneStudio.${ext}',
    requestExecutionLevel: 'user',
  },
};
