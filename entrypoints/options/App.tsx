import { useEffect, useState } from 'react';
import { type IdeId, SUPPORTED_IDES } from '../lib/ideConfig';
import {
  activeIdeIdsStorage,
  getActiveIdeIds,
  setActiveIdeIds,
} from '../lib/ideSettingsStorage';

function App() {
  const [activeIdeIds, setLocalActiveIdeIds] = useState<IdeId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    const loadActiveIds = async () => {
      const ids = await getActiveIdeIds();
      if (disposed) {
        return;
      }

      setLocalActiveIdeIds(ids);
      setIsLoading(false);
    };

    const unwatch = activeIdeIdsStorage.watch((ids) => {
      setLocalActiveIdeIds(ids);
    });

    void loadActiveIds();

    return () => {
      disposed = true;
      unwatch();
    };
  }, []);

  const onToggleIde = async (ideId: IdeId, isChecked: boolean) => {
    const selected = new Set(activeIdeIds);
    if (isChecked) {
      selected.add(ideId);
    } else {
      selected.delete(ideId);
    }

    const nextIds = Array.from(selected);
    setLocalActiveIdeIds(nextIds);
    await setActiveIdeIds(nextIds);
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 bg-[#282c34] px-6 py-8 text-[#f9f9f9]">
      <h1 className="m-0 text-2xl font-semibold">IDE Integrations</h1>
      <p className="m-0 text-[#f9f9f9]">
        Choose which IDE actions appear in GitHub PR comment suggestions.
      </p>
      {isLoading ? (
        <p className="m-0 text-[#258dfa]">Loading...</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {SUPPORTED_IDES.map((ide) => {
            const isChecked = activeIdeIds.includes(ide.id);

            return (
              <li
                key={ide.id}
                className="rounded-lg border border-[#258dfa] bg-[#282c34] p-3"
              >
                <label className="flex cursor-pointer items-center gap-3 text-[#f9f9f9]">
                  <input
                    className="h-4 w-4 accent-[#8fda25]"
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) => {
                      void onToggleIde(ide.id, event.target.checked);
                    }}
                  />
                  <span className="font-medium">{ide.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default App;
