import { useCallback } from 'react';
import { getRandomValues } from 'expo-crypto';
import { useCredentialStore, useRelayStore } from '@/stores';
import { secureStorage } from '@/services/storage/secureStorage';
import { useIgloo } from './useIgloo';
import type { ValidationResult, ShareDetails } from '@/types';

/**
 * Generate a random hex string for echo challenge.
 * @param byteLength Number of random bytes (output will be 2x this in hex chars)
 */
function generateHexChallenge(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hook for credential management during onboarding and settings.
 */
export function useCredentials() {
  const { validateCredentials, getShareDetails, sendEcho } = useIgloo();

  // Credential state
  const hasCredentials = useCredentialStore((s) => s.hasCredentials);
  const shareDetails = useCredentialStore((s) => s.shareDetails);
  const onboardingComplete = useCredentialStore((s) => s.onboardingComplete);
  const echoSent = useCredentialStore((s) => s.echoSent);
  const isHydrated = useCredentialStore((s) => s.isHydrated);

  // Actions
  const setCredentialsExist = useCredentialStore((s) => s.setCredentialsExist);
  const setShareDetails = useCredentialStore((s) => s.setShareDetails);
  const setOnboardingComplete = useCredentialStore((s) => s.setOnboardingComplete);
  const setEchoSent = useCredentialStore((s) => s.setEchoSent);
  const clearCredentials = useCredentialStore((s) => s.clearCredentials);
  const hydrateFromStorage = useCredentialStore((s) => s.hydrateFromStorage);

  // Relay state
  const relays = useRelayStore((s) => s.relays);

  /**
   * Validate share and group credentials.
   */
  const validate = useCallback(
    (share: string, group: string): ValidationResult => {
      return validateCredentials(share, group);
    },
    [validateCredentials]
  );

  /**
   * Save credentials and complete onboarding.
   * Returns true if echo was sent successfully.
   */
  const saveCredentials = useCallback(
    async (share: string, group: string): Promise<{ success: boolean; echoSent: boolean }> => {
      // Validate format first
      const validation = validateCredentials(share, group);
      if (!validation.isValid) {
        throw new Error(
          validation.shareError || validation.groupError || 'Invalid credentials'
        );
      }

      // Decode credentials before saving to ensure they're valid
      // This catches corrupted payloads that pass format validation
      const details = getShareDetails(share, group);
      if (!details) {
        throw new Error('Failed to decode credentials - they may be corrupted');
      }

      // Only persist after decode succeeds
      await secureStorage.saveCredentials(share, group);
      setCredentialsExist(true);
      setShareDetails(details);

      // Send echo signal
      let echoSuccess = false;
      try {
        // Generate a random hex challenge (32 bytes = 64 hex chars)
        const challenge = generateHexChallenge(32);
        echoSuccess = await sendEcho(challenge, relays, group, share);
        setEchoSent(echoSuccess);
      } catch (error) {
        console.warn('Echo failed:', error);
        // Don't fail the whole process if echo fails
      }

      setOnboardingComplete(true);

      return { success: true, echoSent: echoSuccess };
    },
    [
      validateCredentials,
      getShareDetails,
      sendEcho,
      relays,
      setCredentialsExist,
      setShareDetails,
      setEchoSent,
      setOnboardingComplete,
    ]
  );

  /**
   * Delete all credentials and reset state.
   */
  const deleteCredentials = useCallback(async () => {
    await clearCredentials();
  }, [clearCredentials]);

  /**
   * Get stored credentials (for starting signer).
   */
  const getCredentials = useCallback(async () => {
    return secureStorage.getCredentials();
  }, []);

  /**
   * Check if credentials exist in storage.
   */
  const checkCredentials = useCallback(async () => {
    const exists = await secureStorage.hasCredentials();
    setCredentialsExist(exists);
    return exists;
  }, [setCredentialsExist]);

  return {
    // State
    hasCredentials,
    shareDetails,
    onboardingComplete,
    echoSent,
    isHydrated,

    // Actions
    validate,
    saveCredentials,
    deleteCredentials,
    getCredentials,
    checkCredentials,
    hydrateFromStorage,
  };
}
