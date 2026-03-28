export interface DatadogMetricResult {
    status: string;
    query: string;
    series: Array<{
        metric: string;
        pointlist: Array<[number, number]>;
        tag_set?: string[];
    }>;
}
export interface DatadogMonitorResult {
    id: number;
    name: string;
    type: string;
    overall_state: string;
    message: string;
    query: string;
}
export interface DatadogClient {
    queryMetrics(query: string): Promise<DatadogMetricResult>;
    getMonitor(monitorId: string): Promise<DatadogMonitorResult>;
}
export declare function createDatadogClient(apiKey: string, appKey: string): DatadogClient;
