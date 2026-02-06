import { Platform } from 'react-native';

type BackgroundActionsModule = {
  start: (
    task: (taskDataArguments?: Record<string, unknown>) => Promise<void>,
    options: Record<string, unknown>
  ) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
};

let backgroundActions: BackgroundActionsModule | null = null;

if (Platform.OS === 'android') {
  try {
    // Lazy require keeps iOS/web bundles free of Android-only dependency usage.
    backgroundActions = require('react-native-background-actions').default as BackgroundActionsModule;
  } catch {
    backgroundActions = null;
  }
}

class AndroidForegroundSignerService {
  private stopResolver: (() => void) | null = null;

  private async keepAliveTask(): Promise<void> {
    // Wait on a promise that resolves when stop() is called
    await new Promise<void>((resolve) => {
      this.stopResolver = resolve;
    });

    // Cleanup
    this.stopResolver = null;
  }

  async start(): Promise<void> {
    if (Platform.OS !== 'android') return;
    if (!backgroundActions) {
      throw new Error(
        'Android foreground service module is unavailable. Rebuild the app with native modules enabled.'
      );
    }
    if (backgroundActions.isRunning()) return;

    await backgroundActions.start(this.keepAliveTask.bind(this), {
      taskName: 'IglooSigner',
      taskTitle: 'Igloo signer is active',
      taskDesc: 'Background signing is running',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#041b25',
      linkingURI: 'igloo://',
      parameters: {},
    });
  }

  async stop(): Promise<void> {
    if (Platform.OS !== 'android' || !backgroundActions) return;
    if (!backgroundActions.isRunning()) return;

    // Signal the task to complete first
    if (this.stopResolver) {
      this.stopResolver();
      this.stopResolver = null;
    }

    await backgroundActions.stop();
  }

  isRunning(): boolean {
    if (Platform.OS !== 'android' || !backgroundActions) return false;
    return backgroundActions.isRunning();
  }
}

export const androidForegroundSignerService = new AndroidForegroundSignerService();
