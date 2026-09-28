export type AutosaveStep = 'retry' | 'save_as_new_version' | 'stop_and_show';

/**
 * What autosave does after a failed save, by error code:
 * - the version is gone or no longer editable in place → keep the text by saving it as a new manual version;
 * - the text is invalid or the session ended → stop retrying and tell the writer (text stays in local backup);
 * - anything else (network, server, rate limit) is transient → retry with backoff.
 */
export function nextAutosaveStep(code: string): AutosaveStep {
  if (code === 'not_found' || code === 'conflict') return 'save_as_new_version';
  if (code === 'validation' || code === 'unauthorized') return 'stop_and_show';
  return 'retry';
}
