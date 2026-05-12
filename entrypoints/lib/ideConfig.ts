export type IdeId = 'vscode' | 'cursor';

export type IdeTarget = {
  id: IdeId;
  label: string;
  ariaLabel: string;
  buildHref: (prompt: string) => string;
};

const buildVSCodePromptUri = (prompt: string) => {
  const params = new URLSearchParams({
    agent: 'agent',
    prompt,
  });

  return `vscode://GitHub.Copilot-Chat?${params.toString()}`;
};

const buildCursorPromptUri = (prompt: string) => {
  const params = new URLSearchParams({
    text: prompt,
  });

  return `cursor://anysphere.cursor-deeplink/prompt?${params.toString()}`;
};

export const SUPPORTED_IDES: IdeTarget[] = [
  {
    id: 'vscode',
    label: 'Fix in VS Code',
    ariaLabel: 'Open in VS Code',
    buildHref: buildVSCodePromptUri,
  },
  {
    id: 'cursor',
    label: 'Fix in Cursor',
    ariaLabel: 'Open in Cursor',
    buildHref: buildCursorPromptUri,
  },
];

export const SUPPORTED_IDE_IDS: IdeId[] = SUPPORTED_IDES.map(({ id }) => id);

export const isSupportedIdeId = (value: string): value is IdeId =>
  SUPPORTED_IDE_IDS.includes(value as IdeId);

export const getIdeTargetsByIds = (ids: IdeId[]) => {
  const activeIdSet = new Set(ids);
  return SUPPORTED_IDES.filter(({ id }) => activeIdSet.has(id));
};
