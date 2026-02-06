import { useEffect, useState } from 'react';

// NOTE: The default React Native styling doesn't support server rendering.
// Server rendered styles should not change between the first render of the HTML
// and the first render on the client. Typically, web developers will use CSS media queries
// to render different styles on the client and server, these aren't directly supported in React Native
// but can be achieved using a styling library like Nativewind.

/**
 * Gets the initial color scheme based on the user's system preference.
 * Defaults to 'light' if window is not available (SSR).
 */
function getInitialColorScheme(): 'light' | 'dark' {
  if (typeof globalThis !== 'undefined' && 'matchMedia' in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = globalThis as any;
    const mediaQuery = win.matchMedia('(prefers-color-scheme: dark)');
    return mediaQuery.matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(getInitialColorScheme);

  useEffect(() => {
    if (typeof globalThis === 'undefined' || !('matchMedia' in globalThis)) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = globalThis as any;
    const mediaQuery = win.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: { matches: boolean }) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };

    // Set initial value
    handler(mediaQuery);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return colorScheme;
}
