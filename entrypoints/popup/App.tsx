import { Coffee, GitHub, Settings } from 'react-feather';

function App() {
  const SUPPORT_PROJECT_URL = 'https://buymeacoffee.com/roomjs';
  const PROJECT_GITHUB_URL =
    'https://github.com/room-js/github-copilot-comment-browser-extension';
  const buttonClassName =
    'mt-3 inline-flex items-center gap-2 cursor-pointer rounded-lg border border-[#8fda25] bg-[#258dfa] px-3 py-2 text-[0.9rem] font-semibold text-[#f9f9f9] transition-colors hover:bg-[#8fda25] hover:text-[#282c34]';

  const onOpenSettings = async () => {
    await browser.runtime.openOptionsPage();
  };

  const onSupportProject = async () => {
    await browser.tabs.create({ url: SUPPORT_PROJECT_URL });
  };

  const onOpenProjectGithub = async () => {
    await browser.tabs.create({ url: PROJECT_GITHUB_URL });
  };

  return (
    <main className="flex w-120 flex-col items-center justify-center gap-2 bg-[#282c34] p-6 text-center text-[#f9f9f9]">
      <h1 className="m-0 text-[1.2rem] font-semibold">
        Github PR Copilot Comments Enchancer
      </h1>
      <button
        className={buttonClassName}
        type="button"
        onClick={onOpenSettings}
      >
        <Settings size={16} />
        Open Settings
      </button>
      <button
        className={buttonClassName}
        type="button"
        onClick={onSupportProject}
      >
        <Coffee size={16} />
        Support project
      </button>
      <button
        className={buttonClassName}
        type="button"
        onClick={onOpenProjectGithub}
      >
        <GitHub size={16} />
        View on GitHub
      </button>
    </main>
  );
}

export default App;
