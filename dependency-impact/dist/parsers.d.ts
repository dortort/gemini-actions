export interface DependencyChange {
    name: string;
    fromVersion: string;
    toVersion: string;
    ecosystem: string;
}
export declare function parseDependencyChanges(diff: string, files: {
    filename: string;
    patch?: string;
}[]): DependencyChange[];
export declare function getImportPatterns(depName: string, ecosystem: string): string[];
