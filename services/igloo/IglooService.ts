import { Platform } from 'react-native';
import EventEmitter from 'eventemitter3';
import {
  createConnectedNode,
  cleanupBifrostNode,
  validateShare,
  validateGroup,
  getShareDetailsWithGroup,
  extractPeersFromCredentials,
  pingPeersAdvanced,
  sendEcho,
  setNodePolicies,
  decodeGroup,
  decodeShare,
  normalizePubkey,
} from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';
import type { NodeEventConfig, PingResult as IglooPingResult } from '@frostr/igloo-core';
import type {
  SignerStatus,
  SigningRequest,
  SigningResult,
  ValidationResult,
  ShareDetails,
  PeerStatus,
  PeerPolicy,
  PingResult,
  LogLevel,
  LogCategory,
  LogEntry,
  IglooServiceEvents,
} from '@/types';
import type { StartSignerOptions } from './types';
import { audioService } from '@/services/audio';

// Background audio soundscape is iOS-only because:
// 1. iOS requires audio playback for background execution
// 2. Android uses different background execution mechanisms (foreground services)
const ENABLE_BACKGROUND_AUDIO = Platform.OS === 'ios';

/**
 * IglooService - Core service wrapping @frostr/igloo-core for React Native.
 * Uses EventEmitter to communicate with React components via hooks.
 */
class IglooService extends EventEmitter<IglooServiceEvents> {
  private node: BifrostNode | null = null;
  private groupCredential: string | null = null;
  private shareCredential: string | null = null;
  private currentRelays: string[] = [];
  private peerExtractionMode: 'igloo-core' | 'manual' = 'igloo-core';
  private peerExtractionFallbackLogged = false;
  private peerExtractionKey: string | null = null;
  // Track pending signing requests for correlation with completion events
  private pendingRequests: Map<string, SigningRequest> = new Map();
  // Track registered node event handlers for cleanup
  private nodeEventHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  /**
   * Start the signer node and connect to relays.
   */
  async startSigner(
    groupCredential: string,
    shareCredential: string,
    relays: string[],
    options: StartSignerOptions = {}
  ): Promise<void> {
    // Don't start if already running - restart with audio preserved
    if (this.node) {
      this.log('warn', 'system', 'Signer already running, restarting (keeping audio)...');
      await this.stopSigner({ keepAudio: true });
    }

    this.emit('status:changed', 'connecting');
    this.log('info', 'system', 'Starting signer node...', { relays });

    try {
      const eventConfig: NodeEventConfig = {
        enableLogging: true,
        logLevel: 'debug',
        customLogger: (level, message, data) => {
          const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
          if (
            normalizedMessage.includes('ping request rejected') ||
            normalizedMessage.includes('ping rejection sent')
          ) {
            return;
          }
          const tag = extractSignedMessageTag(data);
          if (tag?.startsWith('/sign/')) {
            const session = extractSigningSessionDetails(data);
            const pubkey = extractSignedMessagePubkey(data);
            this.log(level as LogLevel, 'signing', `Signing message ${tag}`, {
              tag,
              pubkey,
              sessionId: session.sessionId,
              sessionType: session.sessionType,
              sessionStamp: session.sessionStamp,
              sessionMembers: session.sessionMembers,
              sessionHashCount: session.sessionHashCount,
              sessionHashPreview: session.sessionHashPreview,
              sessionContent: session.sessionContent ?? undefined,
              payload: data as Record<string, unknown>,
            });
            return;
          }
          this.log(level as LogLevel, 'system', message, data as Record<string, unknown>);
        },
      };

      const { node, state } = await createConnectedNode(
        {
          group: groupCredential,
          share: shareCredential,
          relays,
        },
        eventConfig
      );

      this.node = node;
      this.groupCredential = groupCredential;
      this.shareCredential = shareCredential;
      this.currentRelays = state.connectedRelays;

      // Fail fast if no relays connected
      if (this.currentRelays.length === 0) {
        cleanupBifrostNode(this.node);
        this.node = null;
        this.groupCredential = null;
        this.shareCredential = null;
        this.emit('status:changed', 'error');
        throw new Error('Failed to connect to any relays');
      }

      this.setupNodeEventListeners();

      this.emit('status:changed', 'running');

      // Start background audio to keep app alive in iOS background mode
      if (ENABLE_BACKGROUND_AUDIO) {
        try {
          // Set up callback to receive native audio status changes (interruptions, etc.)
          audioService.setStatusChangeCallback((status) => {
            this.emit('audio:status', status);
            if (status === 'interrupted') {
              this.log('warn', 'system', 'Background audio interrupted (phone call, Siri, etc.)');
            } else if (status === 'error') {
              this.log('warn', 'system', 'Background audio failed to resume');
            } else if (status === 'playing') {
              this.log('info', 'system', 'Background audio resumed');
            }
          });

          await audioService.play();
          this.emit('audio:status', 'playing');

          // Subscribe to native events for interruption handling
          audioService.subscribeToNativeEvents();

          // Start health check as fallback to detect if audio stops unexpectedly
          audioService.startHealthCheck(() => {
            this.emit('audio:status', 'error');
            this.log('warn', 'system', 'Background audio stopped unexpectedly');
          });
        } catch (error) {
          this.emit('audio:status', 'error');
          this.log('warn', 'system', 'Failed to start background audio', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      this.log('info', 'system', 'Signer node started successfully', {
        connectedRelays: state.connectedRelays.length,
        requestedRelays: relays.length,
        failedRelays: relays.length - state.connectedRelays.length,
        audioEnabled: ENABLE_BACKGROUND_AUDIO,
      });

      this.log('info', 'relay', `Connected to ${state.connectedRelays.length} relay(s)`, {
        relays: state.connectedRelays,
      });

      // Emit only for actually connected relays
      state.connectedRelays.forEach((relay) => this.emit('relay:connected', relay));

      // Log warning if some relays failed to connect
      if (state.connectedRelays.length < relays.length) {
        const failedRelays = relays.filter((r) => !state.connectedRelays.includes(r));
        this.log('warn', 'relay', 'Some relays failed to connect', { failedRelays });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('status:changed', 'error');
      this.emit('error', error instanceof Error ? error : new Error(errorMessage));
      this.log('error', 'system', 'Failed to start signer', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop the signer node and clean up resources.
   * @param options.keepAudio - If true, don't stop background audio (used during restart)
   */
  async stopSigner(options: { keepAudio?: boolean } = {}): Promise<void> {
    if (!this.node) {
      this.log('debug', 'system', 'No node to stop');
      return;
    }

    this.log('info', 'system', 'Stopping signer node...', { keepAudio: options.keepAudio });

    try {
      this.log('info', 'relay', 'Disconnecting from relays', {
        relays: this.currentRelays,
      });

      // Emit disconnection events for current relays
      this.currentRelays.forEach((relay) => this.emit('relay:disconnected', relay));

      // Clean up node event listeners before destroying the node
      this.cleanupNodeEventListeners();

      cleanupBifrostNode(this.node);

      this.node = null;
      this.groupCredential = null;
      this.shareCredential = null;
      this.currentRelays = [];
      this.peerExtractionMode = 'igloo-core';
      this.peerExtractionFallbackLogged = false;
      this.peerExtractionKey = null;
      this.pendingRequests.clear();

      this.emit('status:changed', 'stopped');

      // Stop background audio (unless we're restarting)
      if (ENABLE_BACKGROUND_AUDIO && !options.keepAudio) {
        audioService.stopHealthCheck();
        audioService.unsubscribeFromNativeEvents();
        audioService.setStatusChangeCallback(undefined);
        try {
          await audioService.stop();
          this.emit('audio:status', 'idle');
        } catch (audioError) {
          this.log('warn', 'system', 'Failed to stop background audio', {
            error: audioError instanceof Error ? audioError.message : 'Unknown',
          });
        }
      }

      this.log('info', 'system', 'Signer node stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'system', 'Error during node cleanup', { error: errorMessage });
      // Still mark as stopped even if cleanup had issues
      this.emit('status:changed', 'stopped');

      // Also stop audio on error (unless we're restarting)
      if (ENABLE_BACKGROUND_AUDIO && !options.keepAudio) {
        audioService.stopHealthCheck();
        audioService.unsubscribeFromNativeEvents();
        audioService.setStatusChangeCallback(undefined);
        try {
          await audioService.stop();
          this.emit('audio:status', 'idle');
        } catch {
          // Ignore audio stop errors during error handling
        }
      }
    }
  }

  /**
   * Check if signer is currently running.
   */
  isRunning(): boolean {
    return this.node !== null;
  }

  /**
   * Get current connected relays.
   */
  getConnectedRelays(): string[] {
    return [...this.currentRelays];
  }

  /**
   * Validate share and group credentials.
   */
  validateCredentials(share: string, group: string): ValidationResult {
    const shareResult = validateShare(share);
    const groupResult = validateGroup(group);

    return {
      isValid: shareResult.isValid && groupResult.isValid,
      shareValid: shareResult.isValid,
      groupValid: groupResult.isValid,
      shareError: shareResult.isValid ? undefined : shareResult.message,
      groupError: groupResult.isValid ? undefined : groupResult.message,
    };
  }

  /**
   * Validate credentials with actual decoding test.
   * This goes beyond format validation to test if the credentials can be decoded.
   */
  validateCredentialsWithDecode(share: string, group: string): {
    isValid: boolean;
    shareValid: boolean;
    groupValid: boolean;
    canDecode: boolean;
    shareError?: string;
    groupError?: string;
    decodeError?: string;
    peerCount?: number;
    threshold?: number;
    totalMembers?: number;
  } {
    // First do format validation
    const formatResult = this.validateCredentials(share, group);

    if (!formatResult.isValid) {
      return { ...formatResult, canDecode: false };
    }

    // Then test actual decoding
    try {
      const peers = extractPeersFromCredentials(group, share);
      const details = getShareDetailsWithGroup(share, group);

      this.log('debug', 'system', 'Credential decode validation passed', {
        peerCount: peers.length,
        threshold: details.threshold,
        totalMembers: details.totalMembers,
        shareIdx: details.idx,
      });

      return {
        ...formatResult,
        canDecode: true,
        peerCount: peers.length,
        threshold: details.threshold,
        totalMembers: details.totalMembers,
      };
    } catch (error) {
      const decodeError =
        error instanceof Error ? error.message : 'Failed to decode credentials';

      this.log('error', 'system', 'Credential decode validation failed', {
        error: decodeError,
      });

      return {
        ...formatResult,
        canDecode: false,
        decodeError,
      };
    }
  }

  /**
   * Get share details including threshold info.
   * Returns null if credentials cannot be decoded.
   */
  getShareDetails(share: string, group: string): ShareDetails | null {
    try {
      // Decode credentials directly instead of relying on getShareDetailsWithGroup
      // because getShareDetailsWithGroup returns undefined for totalMembers
      // (the GroupPackage type doesn't have that field - only commits[])
      const decodedGroup = decodeGroup(group);
      const decodedShare = decodeShare(share);

      // Calculate totalMembers from commits array length (like igloo-web does)
      const totalMembers = decodedGroup.commits?.length ?? 0;

      // Get group pubkey - it's stored as group_pk in the decoded group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupPubkey = (decodedGroup as any).group_pk || '';

      this.log('debug', 'system', 'Decoded share details', {
        idx: decodedShare.idx,
        threshold: decodedGroup.threshold,
        totalMembers,
        commitsCount: decodedGroup.commits?.length,
        hasGroupPk: !!groupPubkey,
      });

      return {
        idx: decodedShare.idx,
        threshold: decodedGroup.threshold,
        totalMembers,
        groupPubkey,
      };
    } catch (error) {
      this.log('error', 'system', 'Failed to decode share details', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extract peer pubkeys from credentials.
   */
  getPeers(groupCredential?: string, shareCredential?: string): string[] {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      this.log('warn', 'peer', 'Cannot extract peers: missing credentials', {
        hasGroup: !!group,
        hasShare: !!share,
      });
      return [];
    }

    const extractionKey = `${group}:${share}`;
    if (this.peerExtractionKey !== extractionKey) {
      this.peerExtractionKey = extractionKey;
      this.peerExtractionMode = 'igloo-core';
      this.peerExtractionFallbackLogged = false;
    }

    if (this.peerExtractionMode === 'igloo-core') {
      try {
        const peers = extractPeersFromCredentials(group, share).map(normalizePeerPubkey);
        if (peers.length > 0) {
          this.log('debug', 'peer', `Extracted ${peers.length} peers via igloo-core`, {
            peers: peers.map((p) => truncatePubkey(p)),
          });
          return peers;
        }

        this.peerExtractionMode = 'manual';
        if (!this.peerExtractionFallbackLogged) {
          this.peerExtractionFallbackLogged = true;
          this.log('debug', 'peer', 'Peer extraction via igloo-core returned empty, using manual', {
            peerCount: peers.length,
          });
        }
      } catch (error) {
        this.peerExtractionMode = 'manual';
        if (!this.peerExtractionFallbackLogged) {
          this.peerExtractionFallbackLogged = true;
          this.log('debug', 'peer', 'Peer extraction via igloo-core failed, using manual', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    }

    try {
      return this.extractPeersManually(group, share);
    } catch (manualError) {
      this.log('error', 'peer', 'Manual peer extraction failed', {
        error: manualError instanceof Error ? manualError.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Manual peer extraction as fallback when igloo-core returns empty.
   * Extracts peer pubkeys directly from group.commits, excluding self.
   */
  private extractPeersManually(groupCredential: string, shareCredential: string): string[] {
    const decodedGroup = decodeGroup(groupCredential);
    const decodedShare = decodeShare(shareCredential);

    // Find self pubkey by matching share index
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selfCommit = decodedGroup.commits?.find((c: any) => c.idx === decodedShare.idx);
    const selfPubkey = selfCommit?.pubkey ? normalizePeerPubkey(selfCommit.pubkey) : undefined;

    // Extract all peer pubkeys, excluding self
    const peers = (decodedGroup.commits ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((commit: any) => normalizePeerPubkey(commit.pubkey) !== selfPubkey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((commit: any) => normalizePeerPubkey(commit.pubkey));

    this.log('debug', 'peer', 'Manual peer extraction', {
      totalCommits: decodedGroup.commits?.length,
      selfIdx: decodedShare.idx,
      selfPubkey: selfPubkey ? truncatePubkey(selfPubkey) : 'not found',
      peerCount: peers.length,
    });

    return Array.from(new Set(peers));
  }

  /**
   * Get self pubkey from credentials.
   */
  getSelfPubkey(groupCredential?: string, shareCredential?: string): string | null {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      return null;
    }

    try {
      const decodedGroup = decodeGroup(group);
      const decodedShare = decodeShare(share);

      // Find our commit by matching share index
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selfCommit = decodedGroup.commits?.find((c: any) => c.idx === decodedShare.idx);
      const pubkey = selfCommit?.pubkey ? normalizePeerPubkey(selfCommit.pubkey) : null;

      this.log('debug', 'peer', 'Extracted self pubkey', {
        shareIdx: decodedShare.idx,
        found: !!pubkey,
      });

      return pubkey;
    } catch (error) {
      this.log('error', 'peer', 'Failed to get self pubkey', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Ping all peers and return results.
   */
  async pingAllPeers(timeout = 5000): Promise<PingResult[]> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    const peers = this.getPeers().map(normalizePeerPubkey);
    if (peers.length === 0) {
      this.log('info', 'peer', 'No peers to ping');
      return [];
    }

    this.log('info', 'peer', `Pinging ${peers.length} peers...`);

    try {
      const iglooResults = await pingPeersAdvanced(this.node, peers, { timeout });

      // Convert igloo-core PingResult to local PingResult type and emit status updates
      const results: PingResult[] = iglooResults.map((result: IglooPingResult) => {
        const normalizedPubkey = normalizePeerPubkey(result.pubkey);
        const status: PeerStatus = result.success ? 'online' : 'offline';
        this.emit('peer:status', normalizedPubkey, status, result.latency);
        this.log('debug', 'peer', `Ping ${truncatePubkey(normalizedPubkey)}`, {
          success: result.success,
          latency: result.latency,
          error: result.error,
        });

        return {
          success: result.success,
          pubkey: normalizedPubkey,
          latency: result.latency,
          policy: result.policy,
          error: result.error,
          timestamp: result.timestamp,
        };
      });

      return results;
    } catch (error) {
      this.log('error', 'peer', 'Ping operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Ping a single peer and return the result.
   */
  async pingSinglePeer(pubkey: string, timeout = 5000): Promise<PingResult> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    const normalizedPubkey = normalizePeerPubkey(pubkey);
    this.log('info', 'peer', `Pinging peer ${truncatePubkey(normalizedPubkey)}...`);

    try {
      const iglooResults = await pingPeersAdvanced(this.node, [normalizedPubkey], { timeout });

      if (iglooResults.length === 0) {
        const errorResult: PingResult = {
          success: false,
          pubkey: normalizedPubkey,
          error: 'No response',
          timestamp: new Date(),
        };
        this.emit('peer:status', normalizedPubkey, 'offline');
        return errorResult;
      }

      const result = iglooResults[0];
      const resultPubkey = normalizePeerPubkey(result.pubkey);
      const status: PeerStatus = result.success ? 'online' : 'offline';
      this.emit('peer:status', resultPubkey, status, result.latency);

      this.log('info', 'peer', `Ping result ${truncatePubkey(resultPubkey)}`, {
        success: result.success,
        latency: result.latency,
        error: result.error,
      });

      return {
        success: result.success,
        pubkey: resultPubkey,
        latency: result.latency,
        policy: result.policy,
        error: result.error,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.log('error', 'peer', `Ping failed for ${truncatePubkey(normalizedPubkey)}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send echo signal (used during onboarding).
   */
  async sendEchoSignal(
    challenge: string,
    relays: string[],
    groupCredential?: string,
    shareCredential?: string
  ): Promise<boolean> {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      throw new Error('Credentials not available');
    }

    this.log('debug', 'echo', 'Initiating echo signal', { relayCount: relays.length });

    try {
      const result = await sendEcho(group, share, challenge, {
        relays,
        timeout: 10000,
      });

      this.log(result ? 'info' : 'warn', 'echo', `Echo ${result ? 'sent successfully' : 'failed'}`);
      return result;
    } catch (error) {
      this.log('error', 'echo', 'Echo failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update peer policies.
   */
  async updatePeerPolicies(policies: PeerPolicy[]): Promise<void> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    this.log('info', 'peer', 'Updating peer policies', { count: policies.length });

    try {
      await setNodePolicies(
        this.node,
        policies.map((p) => ({
          pubkey: normalizePeerPubkey(p.pubkey),
          allowSend: p.allowSend,
          allowReceive: p.allowReceive,
          label: p.label,
          note: p.note,
        })),
        { merge: true }
      );

      this.log('info', 'peer', 'Peer policies updated successfully');
    } catch (error) {
      this.log('error', 'peer', 'Failed to update policies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up previously registered node event listeners.
   */
  private cleanupNodeEventListeners(): void {
    if (!this.node || this.nodeEventHandlers.length === 0) return;

    const node = this.node as unknown as {
      off: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    for (const { event, handler } of this.nodeEventHandlers) {
      node.off(event, handler);
    }
    this.nodeEventHandlers = [];
  }

  /**
   * Set up event listeners on the BifrostNode.
   */
  private setupNodeEventListeners(): void {
    if (!this.node) return;

    // Clean up any existing handlers first to prevent duplicates
    this.cleanupNodeEventListeners();

    // Cast node to any for event registration since BifrostNode types
    // don't include all the internal event names
    const node = this.node as unknown as {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    // Helper to register and track handlers
    const registerHandler = (event: string, handler: (...args: unknown[]) => void) => {
      node.on(event, handler);
      this.nodeEventHandlers.push({ event, handler });
    };

    // Signing request received
    const handleSigningRequest = (data: unknown) => {
      const meta = extractSigningEventMeta(data);
      const session = extractSigningSessionDetails(data);
      const requestId = meta.id || generateRequestId();
      const request: SigningRequest = {
        id: requestId,
        pubkey: meta.pubkey || 'unknown',
        timestamp: new Date(),
        eventKind: meta.kind,
        status: 'pending',
      };

      // Track pending request for correlation with completion
      this.pendingRequests.set(request.id, request);

      this.log('info', 'signing', 'Received signing request', {
        requestId: request.id,
        pubkey: request.pubkey,
        kind: request.eventKind,
        sessionId: session.sessionId,
        sessionType: session.sessionType,
        sessionStamp: session.sessionStamp,
        sessionMembers: session.sessionMembers,
        sessionHashCount: session.sessionHashCount,
        sessionHashPreview: session.sessionHashPreview,
        sessionContent: session.sessionContent ?? undefined,
      });

      this.emit('signing:request', request);
    };
    registerHandler('/sign/handler/req', handleSigningRequest);

    // Signing completed
    const handleSigningComplete = (data: unknown) => {
      const meta = extractSigningEventMeta(data);
      const session = extractSigningSessionDetails(data);
      // Try to correlate with pending request
      const matchedRequest = this.findAndRemovePendingRequest(data);
      const fallbackRequestId = meta.id || 'unknown';
      const result: SigningResult = {
        requestId: matchedRequest?.id || fallbackRequestId,
        success: true,
      };

      this.log('info', 'signing', 'Signing request completed', {
        requestId: result.requestId,
        pubkey: meta.pubkey,
        kind: meta.kind,
        sessionId: session.sessionId,
        sessionType: session.sessionType,
        sessionStamp: session.sessionStamp,
        sessionHashPreview: session.sessionHashPreview,
      });
      this.emit('signing:complete', result);
    };
    registerHandler('/sign/handler/res', handleSigningComplete);

    // Signing error
    const handleSigningError = (error: unknown) => {
      const meta = extractSigningEventMeta(error);
      const session = extractSigningSessionDetails(error);
      // Try to correlate with pending request
      const matchedRequest = this.findAndRemovePendingRequest(error);
      const errorMessage = Array.isArray(error)
        ? String(error[0])
        : error instanceof Error
          ? error.message
          : String(error);
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      this.log('error', 'signing', 'Signing error', {
        requestId: matchedRequest?.id || meta.id,
        pubkey: meta.pubkey,
        kind: meta.kind,
        error: errorMessage,
        sessionId: session.sessionId,
        sessionType: session.sessionType,
        sessionStamp: session.sessionStamp,
        sessionMembers: session.sessionMembers,
        sessionHashCount: session.sessionHashCount,
        sessionHashPreview: session.sessionHashPreview,
        sessionContent: session.sessionContent ?? undefined,
      });
      this.emit('signing:error', errorObj, matchedRequest?.id || meta.id);
    };
    registerHandler('/sign/handler/rej', handleSigningError);

    // Signing request sent (sender) responses received
    const handleSigningSenderRes = (payload: unknown) => {
      const messages = Array.isArray(payload)
        ? (payload as Array<{ data?: { sid?: string }; env?: { pubkey?: string } }>)
        : [];
      const sessionId = messages[0]?.data?.sid;
      const peerList = formatPubkeyList(messages.map((msg) => msg?.env?.pubkey));
      this.log('info', 'signing', 'Received signing responses from peers', {
        sessionId,
        peerCount: messages.length,
        peerPubkeys: peerList.sample,
        peerPubkeysTruncated: peerList.truncated,
      });
    };
    registerHandler('/sign/sender/res', handleSigningSenderRes);

    // Signing request finalized (sender)
    const handleSigningSenderRet = (payload: unknown) => {
      const sessionId = Array.isArray(payload) ? payload[0] : undefined;
      const signatures = Array.isArray(payload) ? payload[1] : undefined;
      const signatureCount = Array.isArray(signatures) ? signatures.length : undefined;
      const signaturePubkeys = Array.isArray(signatures)
        ? signatures.map((entry) => (Array.isArray(entry) ? entry[1] : undefined))
        : [];
      const peerList = formatPubkeyList(signaturePubkeys);
      this.log('info', 'signing', 'Signing request finalized', {
        sessionId,
        signatureCount,
        signerPubkeys: peerList.sample,
        signerPubkeysTruncated: peerList.truncated,
      });
    };
    registerHandler('/sign/sender/ret', handleSigningSenderRet);

    // Signing request rejected before finalize (sender)
    const handleSigningSenderRej = (payload: unknown) => {
      const reason = Array.isArray(payload) ? payload[0] : payload;
      const session = Array.isArray(payload) ? payload[1] : undefined;
      const sessionDetails = extractSigningSessionDetails(session);
      const sessionId = sessionDetails.sessionId;
      this.log('warn', 'signing', 'Signing request rejected', {
        sessionId,
        reason: reason ? String(reason) : undefined,
        sessionType: sessionDetails.sessionType,
        sessionStamp: sessionDetails.sessionStamp,
        sessionMembers: sessionDetails.sessionMembers,
        sessionHashCount: sessionDetails.sessionHashCount,
        sessionHashPreview: sessionDetails.sessionHashPreview,
        sessionContent: sessionDetails.sessionContent ?? undefined,
      });
    };
    registerHandler('/sign/sender/rej', handleSigningSenderRej);

    // Signing request failed during finalize (sender)
    const handleSigningSenderErr = (payload: unknown) => {
      const reason = Array.isArray(payload) ? payload[0] : payload;
      const messages = Array.isArray(payload) ? payload[1] : undefined;
      const sessionId = Array.isArray(messages)
        ? (messages[0] as { data?: { sid?: string } } | undefined)?.data?.sid
        : undefined;
      const peerList = formatPubkeyList(
        Array.isArray(messages)
          ? messages.map((msg) => (msg as { env?: { pubkey?: string } } | undefined)?.env?.pubkey)
          : []
      );
      this.log('error', 'signing', 'Signing request failed', {
        sessionId,
        reason: reason ? String(reason) : undefined,
        peerPubkeys: peerList.sample,
        peerPubkeysTruncated: peerList.truncated,
      });
    };
    registerHandler('/sign/sender/err', handleSigningSenderErr);

    // Peer ping events (inbound/outbound)
    // Build known peers set once at registration time for efficient lookup.
    // This prevents unknown pubkeys from being added to the peer store.
    const knownPeers = new Set(this.getPeers().map(normalizePeerPubkey));

    const handlePingRequest = (msg: unknown) => {
      const pubkey = extractPingPubkeyFromMessage(msg);
      if (!pubkey || !knownPeers.has(pubkey)) return;
      this.emit('peer:status', pubkey, 'online');
      this.log('debug', 'peer', 'Received ping request', {
        pubkey: truncatePubkey(pubkey),
      });
    };
    registerHandler('/ping/handler/req', handlePingRequest);

    const handlePingSenderRet = (data: unknown) => {
      const pubkey = extractPingPubkeyFromPeerData(data);
      if (!pubkey || !knownPeers.has(pubkey)) return;
      this.emit('peer:status', pubkey, 'online');
      this.log('debug', 'peer', 'Ping response received', {
        pubkey: truncatePubkey(pubkey),
      });
    };
    registerHandler('/ping/sender/ret', handlePingSenderRet);

    const handlePingSenderErr = (payload: unknown) => {
      const pubkey = extractPingPubkeyFromError(payload);
      if (!pubkey || !knownPeers.has(pubkey)) return;
      this.emit('peer:status', pubkey, 'offline');
      this.log('debug', 'peer', 'Ping failed', {
        pubkey: truncatePubkey(pubkey),
      });
    };
    registerHandler('/ping/sender/err', handlePingSenderErr);
    registerHandler('/ping/sender/rej', handlePingSenderErr);

    // Node error
    const handleNodeError = (error: unknown) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log('error', 'system', 'Node error', { error: errorObj.message });
      this.emit('error', errorObj);
    };
    registerHandler('error', handleNodeError);

    // Node closed
    const handleNodeClosed = () => {
      this.log('warn', 'system', 'Node connection closed');
      this.emit('status:changed', 'stopped');
    };
    registerHandler('closed', handleNodeClosed);

    // Debug/info messages
    const handleDebug = (message: unknown, data?: unknown) => {
      const tag = extractSignedMessageTag(data);
      if (tag?.startsWith('/sign/')) {
        const session = extractSigningSessionDetails(data);
        const pubkey = extractSignedMessagePubkey(data);
        this.log('debug', 'signing', `Signing message ${tag}`, {
          tag,
          pubkey,
          sessionId: session.sessionId,
          sessionType: session.sessionType,
          sessionStamp: session.sessionStamp,
          sessionMembers: session.sessionMembers,
          sessionHashCount: session.sessionHashCount,
          sessionHashPreview: session.sessionHashPreview,
          sessionContent: session.sessionContent ?? undefined,
          payload: data as Record<string, unknown>,
        });
        return;
      }
      this.log('debug', 'system', String(message));
    };
    registerHandler('debug', handleDebug);

    const handleInfo = (message: unknown, data?: unknown) => {
      const tag = extractSignedMessageTag(data);
      if (tag?.startsWith('/sign/')) {
        const session = extractSigningSessionDetails(data);
        const pubkey = extractSignedMessagePubkey(data);
        this.log('info', 'signing', `Signing message ${tag}`, {
          tag,
          pubkey,
          sessionId: session.sessionId,
          sessionType: session.sessionType,
          sessionStamp: session.sessionStamp,
          sessionMembers: session.sessionMembers,
          sessionHashCount: session.sessionHashCount,
          sessionHashPreview: session.sessionHashPreview,
          sessionContent: session.sessionContent ?? undefined,
          payload: data as Record<string, unknown>,
        });
        return;
      }
      this.log('info', 'system', String(message));
    };
    registerHandler('info', handleInfo);
  }

  /**
   * Remove stale pending requests that have exceeded the max age.
   * Prevents unbounded growth of pendingRequests Map when correlation fails.
   */
  private cleanupStaleRequests(maxAgeMs = 30000): void {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests) {
      const age = now - request.timestamp.getTime();
      if (age > maxAgeMs) {
        this.pendingRequests.delete(id);
        this.log('warn', 'signing', 'Evicted stale signing request (>30s old)', {
          id,
          pubkey: truncatePubkey(request.pubkey),
          ageMs: age,
        });
      }
    }
  }

  /**
   * Find and remove a pending request that matches the completion/error data.
   * Tries to match by pubkey if available. Falls back to FIFO only when there's
   * exactly one pending request (unambiguous). Returns undefined if correlation
   * is ambiguous to avoid mis-matching requests.
   */
  private findAndRemovePendingRequest(data: unknown): SigningRequest | undefined {
    // Clean up stale requests first to prevent memory leaks
    this.cleanupStaleRequests();

    if (this.pendingRequests.size === 0) {
      return undefined;
    }

    // Prefer matching by request id when available
    const eventMeta = extractSigningEventMeta(data);
    const eventId = eventMeta.id;
    const eventPubkey = eventMeta.pubkey;

    if (eventId && this.pendingRequests.has(eventId)) {
      const request = this.pendingRequests.get(eventId);
      if (request) {
        this.pendingRequests.delete(eventId);
        return request;
      }
    }

    if (eventPubkey) {
      // Find a pending request with matching pubkey
      for (const [id, request] of this.pendingRequests) {
        if (request.pubkey === eventPubkey) {
          this.pendingRequests.delete(id);
          return request;
        }
      }
    }

    // Only use FIFO when there's exactly one pending request (unambiguous)
    if (this.pendingRequests.size === 1) {
      const oldestEntry = this.pendingRequests.entries().next().value;
      if (oldestEntry) {
        const [id, request] = oldestEntry;
        this.pendingRequests.delete(id);
        return request;
      }
    }

    // Multiple pending requests without pubkey match - cannot correlate safely
    if (this.pendingRequests.size > 1) {
      this.log('warn', 'signing', 'Cannot correlate signing completion - ambiguous pubkey match', {
        pendingCount: this.pendingRequests.size,
        hasEventPubkey: !!eventPubkey,
      });
    }

    return undefined;
  }

  /**
   * Decode a group credential to get its raw data.
   * Returns the decoded group object or null on error.
   */
  decodeGroupCredential(group: string): object | null {
    try {
      return decodeGroup(group);
    } catch (error) {
      this.log('error', 'system', 'Failed to decode group credential', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Decode a share credential to get its raw data.
   * Returns the decoded share object or null on error.
   */
  decodeShareCredential(share: string): object | null {
    try {
      return decodeShare(share);
    } catch (error) {
      this.log('error', 'system', 'Failed to decode share credential', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the currently loaded credentials (if signer has started).
   */
  getLoadedCredentials(): { group: string | null; share: string | null } {
    return {
      group: this.groupCredential,
      share: this.shareCredential,
    };
  }

  /**
   * Internal logging helper that emits to event listeners.
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: Omit<LogEntry, 'id' | 'timestamp'> = {
      level,
      category,
      message,
      data,
    };
    this.emit('log', entry);
  }
}

// Helper functions
function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function normalizePeerPubkey(pubkey: string): string {
  if (!pubkey) return pubkey;
  return normalizePubkey(pubkey).toLowerCase();
}

function extractPingPubkeyFromMessage(message: unknown): string | null {
  const pubkey = (message as { env?: { pubkey?: string } } | null)?.env?.pubkey;
  return pubkey ? normalizePeerPubkey(pubkey) : null;
}

function extractPingPubkeyFromPeerData(data: unknown): string | null {
  const pubkey = (data as { pubkey?: string } | null)?.pubkey;
  return pubkey ? normalizePeerPubkey(pubkey) : null;
}

function extractPingPubkeyFromError(payload: unknown): string | null {
  if (!Array.isArray(payload)) return null;
  const msg = payload[1] as { env?: { pubkey?: string } } | undefined;
  const pubkey = msg?.env?.pubkey;
  return pubkey ? normalizePeerPubkey(pubkey) : null;
}

function formatPubkeyList(
  pubkeys: Array<string | undefined>,
  maxCount = 5
): { sample: string[]; truncated: boolean } {
  const unique = Array.from(new Set(pubkeys.filter((key): key is string => !!key)));
  const sample = unique.slice(0, maxCount).map(truncatePubkey);
  return { sample, truncated: unique.length > maxCount };
}

function extractSigningEventMeta(payload: unknown): { id?: string; pubkey?: string; kind?: number } {
  if (!payload) return {};
  if (Array.isArray(payload)) {
    return extractSigningEventMeta(payload[1]);
  }
  if (typeof payload !== 'object') return {};
  const message = payload as { id?: string; env?: { pubkey?: string; kind?: number } };
  return {
    id: typeof message.id === 'string' ? message.id : undefined,
    pubkey: message.env?.pubkey,
    kind: message.env?.kind,
  };
}

function extractSigningPayload(payload: unknown): unknown {
  if (!payload) return undefined;
  if (Array.isArray(payload)) {
    return extractSigningPayload(payload[1]);
  }
  if (typeof payload !== 'object') return undefined;
  if ('data' in payload) {
    const data = (payload as { data?: unknown }).data;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }
  return payload;
}

function findNestedKey(payload: unknown, key: string, maxDepth = 4): unknown {
  const seen = new WeakSet<object>();

  const search = (value: unknown, depth: number): unknown => {
    if (!value || depth < 0) return undefined;
    if (typeof value !== 'object') return undefined;

    if (seen.has(value as object)) return undefined;
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = search(item, depth - 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    const obj = value as Record<string, unknown>;
    if (key in obj) return obj[key];

    for (const entry of Object.values(obj)) {
      const found = search(entry, depth - 1);
      if (found !== undefined) return found;
    }

    return undefined;
  };

  return search(payload, maxDepth);
}

function extractSignedMessageTag(payload: unknown): string | undefined {
  const tag = findNestedKey(payload, 'tag');
  return typeof tag === 'string' ? tag : undefined;
}

function extractSignedMessagePubkey(payload: unknown): string | undefined {
  const env = findNestedKey(payload, 'env') as { pubkey?: string } | undefined;
  if (env?.pubkey) return env.pubkey;
  const pubkey = findNestedKey(payload, 'pubkey');
  return typeof pubkey === 'string' ? pubkey : undefined;
}

function extractSigningSessionDetails(payload: unknown): {
  sessionId?: string;
  sessionType?: string;
  sessionStamp?: number;
  sessionContent?: string | null;
  sessionMembers?: number[];
  sessionHashCount?: number;
  sessionHashPreview?: string;
} {
  const data = extractSigningPayload(payload);
  if (!data || typeof data !== 'object') return {};
  const session = data as {
    sid?: string;
    type?: string;
    stamp?: number;
    content?: string | null;
    members?: number[];
    hashes?: unknown[];
    psigs?: unknown[];
  };
  const firstHash = Array.isArray(session.hashes)
    ? (session.hashes[0] as unknown[] | undefined)
    : undefined;
  const hashFromHashes =
    Array.isArray(firstHash) && typeof firstHash[0] === 'string'
      ? firstHash[0]
      : undefined;
  const firstPsig = Array.isArray(session.psigs)
    ? (session.psigs[0] as unknown[] | undefined)
    : undefined;
  const hashFromPsigs =
    Array.isArray(firstPsig) && typeof firstPsig[0] === 'string'
      ? firstPsig[0]
      : undefined;
  const hashPreview = hashFromHashes ?? hashFromPsigs;
  return {
    sessionId: session.sid,
    sessionType: session.type,
    sessionStamp: session.stamp,
    sessionContent: session.content ?? undefined,
    sessionMembers: Array.isArray(session.members) ? session.members : undefined,
    sessionHashCount: Array.isArray(session.hashes) ? session.hashes.length : undefined,
    sessionHashPreview: hashPreview,
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Export singleton instance
export const iglooService = new IglooService();

// Export class for testing
export { IglooService };
