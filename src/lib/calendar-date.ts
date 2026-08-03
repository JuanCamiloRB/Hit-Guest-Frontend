/**
 * Parses a date-only API value as a local calendar date.
 *
 * JavaScript treats `new Date("2026-07-23")` as midnight UTC, which can render
 * as the previous day in time zones west of UTC. Calendar dates do not
 * represent an instant, so construct them in local time instead. Noon avoids
 * edge cases around daylight-saving transitions.
 *
 * Values that include a time keep the native Date semantics.
 */
export function parseCalendarDate(value: unknown): Date {
    if (value instanceof Date) return new Date(value.getTime())

    if (typeof value === "string") {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
        if (match) {
            const [, year, month, day] = match
            return new Date(Number(year), Number(month) - 1, Number(day), 12)
        }

        return new Date(value)
    }

    if (typeof value === "number") return new Date(value)

    return new Date(Number.NaN)
}
