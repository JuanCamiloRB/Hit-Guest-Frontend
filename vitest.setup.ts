import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// No `globals: true` in vitest.config.mts, so RTL's auto-cleanup (which relies
// on detecting a global afterEach) never registers on its own — without this,
// each render() in a test file accumulates on top of the previous test's DOM
// instead of replacing it, so "getByText"/"getByRole" queries that are unique
// in isolation start throwing "multiple elements found" from the 2nd test on.
afterEach(() => {
    cleanup()
})
