import { CopilotCommentButtonEnhancer } from './lib/CopilotCommentButtonEnhancer';
import { getIdeTargetsByIds } from './lib/ideConfig';
import { getActiveIdeIds } from './lib/ideSettingsStorage';

export default defineContentScript({
  matches: ['https://github.com/*/*/pull/*'],
  async main() {
    const activeIdeIds = await getActiveIdeIds();
    const ideTargets = getIdeTargetsByIds(activeIdeIds);
    const enhancer = new CopilotCommentButtonEnhancer(ideTargets);
    enhancer.run();
  },
});
