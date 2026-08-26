// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
// for component tests. Extend explicitly so jsdom files get the matchers
// even when Vitest's vitest-entry side-effect import is skipped.
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);
