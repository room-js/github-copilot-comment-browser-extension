import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'GitHub PR Copilot Comments Enhancer',
    short_name: 'gh-pr-cc-enh',
    permissions: ['storage'],
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
