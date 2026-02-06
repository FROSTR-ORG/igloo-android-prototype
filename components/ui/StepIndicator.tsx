import { View, Text } from 'react-native';
import { Check } from 'lucide-react-native';

interface Step {
  /** Step label (e.g., "Group", "Share", "Save") */
  label: string;
  /** Optional icon to show in the step circle */
  icon?: React.ReactNode;
}

interface StepIndicatorProps {
  /** Array of step definitions */
  steps: Step[];
  /** Current active step (0-indexed) */
  currentStep: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * Step indicator component for multi-step wizards.
 * Shows numbered circles with connectors, matching desktop pattern.
 *
 * @example
 * <StepIndicator
 *   steps={[
 *     { label: 'Group' },
 *     { label: 'Share' },
 *     { label: 'Save' },
 *   ]}
 *   currentStep={1}
 * />
 */
export function StepIndicator({
  steps,
  currentStep,
  className = '',
}: StepIndicatorProps) {
  const clampedStep = Math.max(0, Math.min(currentStep, steps.length - 1));

  if (__DEV__ && currentStep !== clampedStep) {
    console.warn(
      `StepIndicator: currentStep ${currentStep} out of range [0, ${steps.length - 1}], clamped to ${clampedStep}`
    );
  }

  return (
    <View className={`flex-row items-center justify-center ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < clampedStep;
        const isCurrent = index === clampedStep;
        const isLast = index === steps.length - 1;

        return (
          <View key={index} className="flex-row items-center">
            {/* Step Circle */}
            <View className="items-center">
              <View
                className={`
                  w-8 h-8 rounded-full items-center justify-center
                  ${isCompleted
                    ? 'bg-green-600'
                    : isCurrent
                      ? 'bg-blue-600'
                      : 'bg-gray-700'
                  }
                `}
              >
                {isCompleted ? (
                  <Check size={16} color="white" strokeWidth={2.5} />
                ) : step.icon ? (
                  step.icon
                ) : (
                  <Text
                    className={`
                      text-sm font-semibold
                      ${isCurrent ? 'text-white' : 'text-gray-400'}
                    `}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              {/* Step Label */}
              <Text
                className={`
                  text-xs mt-1
                  ${isCompleted
                    ? 'text-green-400'
                    : isCurrent
                      ? 'text-blue-400'
                      : 'text-gray-500'
                  }
                `}
              >
                {step.label}
              </Text>
            </View>

            {/* Connector Line */}
            {!isLast && (
              <View
                className={`
                  h-0.5 w-8 mx-2
                  ${isCompleted ? 'bg-green-600' : 'bg-gray-700'}
                `}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

interface StepBadgeProps {
  /** Current step number (1-indexed for display) */
  current: number;
  /** Total number of steps */
  total: number;
  /** Optional className */
  className?: string;
}

/**
 * Simple step badge showing "Step X/Y" format.
 * Used for compact step indication.
 */
export function StepBadge({ current, total, className = '' }: StepBadgeProps) {
  return (
    <View
      className={`
        bg-blue-900/30 px-2.5 py-1 rounded-full
        border border-blue-800/30
        ${className}
      `}
    >
      <Text className="text-xs font-medium text-blue-300">
        Step {current}/{total}
      </Text>
    </View>
  );
}
