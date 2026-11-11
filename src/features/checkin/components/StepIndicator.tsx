"use client"

import { Check } from "lucide-react"

interface Step {
  label: string
  key: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: string
  completedSteps?: string[]
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(step.key)
        const isCurrent = step.key === currentStep
        const isPast = i < currentIndex

        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            {/* Step Dot/Number */}
            <div
              className={`
                flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold
                transition-all duration-500 flex-shrink-0
                ${isCompleted || isPast
                  ? "bg-success text-white shadow-sm"
                  : isCurrent
                  ? "bg-primary text-white shadow-sm scale-110"
                  : "bg-sunk text-ink-3"
                }
              `}
            >
              {isCompleted || isPast ? (
                <Check size={14} strokeWidth={3} />
              ) : (
                i + 1
              )}
            </div>

            {/* Connector Line (not after last) */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full overflow-hidden mx-1">
                <div
                  className={`
                    h-full rounded-full transition-all duration-700
                    ${isPast || isCompleted
                      ? "bg-success w-full"
                      : isCurrent
                      ? "bg-primary w-full"
                      : "bg-sunk w-full"
                    }
                  `}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
