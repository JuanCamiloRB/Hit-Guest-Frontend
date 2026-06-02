import { cn } from "@/lib/utils"

interface ProgressRingProps {
    progress: number // 0 to 100
    size?: number
    strokeWidth?: number
    className?: string
}

export function ProgressRing({
    progress,
    size = 40,
    strokeWidth = 4,
    className,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (progress / 100) * circumference

    return (
        <svg
            width={size}
            height={size}
            className={cn("transform -rotate-90", className)}
        >
            {/* Background circle */}
            <circle
                className="text-slate-200"
                strokeWidth={strokeWidth}
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            {/* Progress circle */}
            <circle
                className={cn(
                    "transition-all duration-500 ease-in-out",
                    progress === 100 ? "text-green-500" : "text-[var(--color-brand-blue)]"
                )}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
        </svg>
    )
}
