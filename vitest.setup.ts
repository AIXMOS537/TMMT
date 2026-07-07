// Registers @testing-library/jest-dom matchers for component tests.
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);
