import { View, StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientBackgroundProps extends ViewProps {
  children: React.ReactNode;
}

/**
 * Gradient background component matching igloo-desktop.
 * Creates a gradient from gray-950 to blue-950.
 *
 * Uses expo-linear-gradient for native performance.
 */
export function GradientBackground({ children, style, ...props }: GradientBackgroundProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <LinearGradient
        // Colors: from-gray-950 (#030712) to-blue-950 (#172554)
        colors={['#030712', '#0c1929', '#172554']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * Subtle gradient variant for cards or sections.
 * Lighter gradient for layered UI elements.
 */
export function SubtleGradient({ children, style, ...props }: GradientBackgroundProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <LinearGradient
        // Subtle: from gray-900/40 to gray-800/40 with blue tint
        colors={['rgba(17, 24, 39, 0.4)', 'rgba(23, 37, 84, 0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
