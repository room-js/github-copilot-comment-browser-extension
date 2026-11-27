import { CopilotCommentButtonEnhancer } from './lib/CopilotCommentButtonEnhancer';
import { getIdeTargetsByIds } from './lib/ideConfig';
import { getActiveIdeIds } from './lib/ideSettingsStorage';

export default defineContentScript({
  // GitHub can navigate to a PR without loading a new document.
  matches: ['https://github.com/*'],
  async main() {
    const activeIdeIds = await getActiveIdeIds();
    const ideTargets = getIdeTargetsByIds(activeIdeIds);
    const enhancer = new CopilotCommentButtonEnhancer(ideTargets);
    enhancer.run();
  },
});
