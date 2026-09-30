import { Config } from '@remotion/cli/config'

// pnpm puts the font packages in the repo root's node_modules, outside video/. The Studio names assets by path, so their
// URLs escape its dev server and the fonts get its HTML fallback; renders already use hashed names, so use them here too.
Config.overrideWebpackConfig(config => ({
  ...config,
  output: { ...config.output, assetModuleFilename: '[hash][ext]' }
}))
