import type { DistressStructured } from "./types.js";
/**
 * Without OPENAI_API_KEY: lightweight keyword / pattern extraction.
 * With key: optional upgrade path (not required for laptop demo).
 */
export declare function parseDistressMessage(text: string): Promise<DistressStructured>;
export declare function distressSeverityScore(s: DistressStructured): number;
