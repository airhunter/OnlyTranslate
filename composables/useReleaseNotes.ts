import { computed, ref } from 'vue';
import { storage } from '@wxt-dev/storage';
import browser from 'webextension-polyfill';
import {
  RELEASE_NOTES_INIT_KEY,
  RELEASE_NOTES_SEEN_VERSION_KEY,
  findReleaseNoteByVersion
} from '@/entrypoints/utils/releaseNotes';

function isTruthyStorageValue(value: unknown): boolean {
  return value === true || value === 'true';
}

export function useReleaseNotes() {
  const currentVersion = browser.runtime.getManifest().version;
  const currentReleaseNote = computed(() => findReleaseNoteByVersion(currentVersion));
  const hasUnreadReleaseNotes = ref(false);

  const updateUnreadState = (initialized: unknown, lastSeenVersion: unknown) => {
    hasUnreadReleaseNotes.value = !!currentReleaseNote.value
      && isTruthyStorageValue(initialized)
      && lastSeenVersion !== currentVersion;
  };

  const loadReleaseNotesState = async () => {
    const [initialized, lastSeenVersion] = await Promise.all([
      storage.getItem(RELEASE_NOTES_INIT_KEY),
      storage.getItem(RELEASE_NOTES_SEEN_VERSION_KEY)
    ]);

    updateUnreadState(initialized, lastSeenVersion);
  };

  const markCurrentReleaseNotesAsSeen = async () => {
    await Promise.all([
      storage.setItem(RELEASE_NOTES_INIT_KEY, true),
      storage.setItem(RELEASE_NOTES_SEEN_VERSION_KEY, currentVersion)
    ]);
    hasUnreadReleaseNotes.value = false;
  };

  storage.watch(RELEASE_NOTES_INIT_KEY, () => {
    void loadReleaseNotesState();
  });

  storage.watch(RELEASE_NOTES_SEEN_VERSION_KEY, () => {
    void loadReleaseNotesState();
  });

  return {
    currentVersion,
    currentReleaseNote,
    hasUnreadReleaseNotes,
    loadReleaseNotesState,
    markCurrentReleaseNotesAsSeen
  };
}
