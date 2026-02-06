import type { Credentials } from '@/types';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  SHARE: 'igloo_bfshare',
  GROUP: 'igloo_bfgroup',
} as const;

/**
 * Secure storage service for credential management.
 * Uses expo-secure-store which encrypts data at rest.
 */
export const secureStorage = {
  /**
   * Save both share and group credentials securely.
   */
  async saveCredentials(share: string, group: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.SHARE, share),
      SecureStore.setItemAsync(STORAGE_KEYS.GROUP, group),
    ]);
  },

  /**
   * Retrieve stored credentials.
   * Returns null if either credential is missing.
   */
  async getCredentials(): Promise<Credentials | null> {
    const [share, group] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SHARE),
      SecureStore.getItemAsync(STORAGE_KEYS.GROUP),
    ]);

    if (!share || !group) {
      return null;
    }

    return { share, group };
  },

  /**
   * Delete all stored credentials.
   */
  async clearCredentials(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.SHARE),
      SecureStore.deleteItemAsync(STORAGE_KEYS.GROUP),
    ]);
  },

  /**
   * Check if credentials exist without loading them.
   * Returns true only if both share and group are present.
   */
  async hasCredentials(): Promise<boolean> {
    const [share, group] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SHARE),
      SecureStore.getItemAsync(STORAGE_KEYS.GROUP),
    ]);
    return share !== null && group !== null;
  },

  /**
   * Get just the share credential (for validation checks).
   */
  async getShare(): Promise<string | null> {
    return SecureStore.getItemAsync(STORAGE_KEYS.SHARE);
  },

  /**
   * Get just the group credential (for validation checks).
   */
  async getGroup(): Promise<string | null> {
    return SecureStore.getItemAsync(STORAGE_KEYS.GROUP);
  },
};

export default secureStorage;
