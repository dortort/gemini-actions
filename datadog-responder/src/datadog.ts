import * as https from "https";

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

async function datadogRequest(
  apiKey: string,
  appKey: string,
  endpoint: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`https://api.datadoghq.com${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "DD-API-KEY": apiKey,
          "DD-APPLICATION-KEY": appKey,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Failed to parse Datadog response: ${body.slice(0, 500)}`));
          }
        });
      },
    );
    req.on("error", reject);
  });
}

export function createDatadogClient(apiKey: string, appKey: string): DatadogClient {
  return {
    async queryMetrics(query: string): Promise<DatadogMetricResult> {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;

      return (await datadogRequest(apiKey, appKey, "/api/v1/query", {
        from: oneHourAgo.toString(),
        to: now.toString(),
        query,
      })) as DatadogMetricResult;
    },

    async getMonitor(monitorId: string): Promise<DatadogMonitorResult> {
      return (await datadogRequest(
        apiKey,
        appKey,
        `/api/v1/monitor/${monitorId}`,
      )) as DatadogMonitorResult;
    },
  };
}
