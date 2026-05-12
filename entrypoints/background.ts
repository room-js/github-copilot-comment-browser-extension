import { PROJECT_GITHUB_URL } from './lib/projectLinks';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') {
      return;
    }

    browser.tabs.create({
      url: PROJECT_GITHUB_URL,
      active: true,
    });
  });
});
