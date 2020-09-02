export const FS: {
    writeFile: (path: string, data: Uint8Array, opts?: any) => void;
    readFile: (path: string) => Uint8Array,
};
export function callMain(args: string[]): void;
export let onRuntimeInitialized: () => void;
export let verbose: typeof console.log;
