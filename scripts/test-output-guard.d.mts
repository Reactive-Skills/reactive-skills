/** Directories where engine output lands when a test omits `workspaceDir`. */
export declare const OUTPUT_BASES: string[];
/** Record every directory under `.docs/` and `.reactive/` in the output bases. */
export declare function snapshotTestOutput(bases?: string[]): Set<string>;
/** Throw when a test run created directories under `.docs/` or `.reactive/` outside a temp workspace. */
export declare function assertNoNewTestOutput(before: Set<string>, bases?: string[]): void;
