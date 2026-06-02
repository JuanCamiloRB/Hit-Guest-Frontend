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
                  ? "bg-green-500 text-white shadow-sm shadow-green-500/20"
                  : isCurrent
                  ? "bg-brand-purple text-white shadow-md shadow-brand-purple/20 scale-110"
                  : "bg-slate-200 text-slate-400"
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
                      ? "bg-green-400 w-full"
                      : isCurrent
                      ? "bg-gradient-to-r from-brand-purple to-slate-200 w-full"
                      : "bg-slate-200 w-full"
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
