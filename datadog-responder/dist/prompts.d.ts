export interface RecentCommit {
    sha: string;
    message: string;
    date: string | undefined;
    author: string | undefined;
}
export declare function buildAnalysisPrompt(datadogData: string, isMonitorId: boolean, recentCommits: RecentCommit[], owner: string, repo: string, action: string): string;
