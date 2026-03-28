export type RegistryResolver = (dep: {
    name: string;
    ecosystem: string;
}) => Promise<{
    owner: string;
    repo: string;
} | null>;
export declare function createRegistryResolver(fetchFn?: typeof fetch): RegistryResolver;
