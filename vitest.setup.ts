import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-unmounts when Vitest globals are on; they are off here.
afterEach(cleanup);
