import { storage } from '@wxt-dev/storage';
import { type IdeId, isSupportedIdeId, SUPPORTED_IDE_IDS } from './ideConfig';

const dedupe = <T>(values: T[]) => Array.from(new Set(values));

const normalizeIdeIds = (rawIds: string[]) => {
  const supportedIds = rawIds.filter(isSupportedIdeId);
  const dedupedIds = dedupe(supportedIds);
  return dedupedIds.length ? dedupedIds : [...SUPPORTED_IDE_IDS];
};

export const activeIdeIdsStorage = storage.defineItem<IdeId[]>(
  'local:activeIdeIds',
  {
    fallback: [...SUPPORTED_IDE_IDS],
  },
);

export const getActiveIdeIds = async (): Promise<IdeId[]> => {
  const rawIds = await activeIdeIdsStorage.getValue();
  return normalizeIdeIds(rawIds);
};

export const setActiveIdeIds = async (ids: IdeId[]) => {
  const normalized = normalizeIdeIds(ids);
  await activeIdeIdsStorage.setValue(normalized);
};
