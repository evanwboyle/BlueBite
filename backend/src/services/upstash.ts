/** Minimal Upstash Redis REST client (plain fetch, so it runs in any serverless runtime). */
export class UpstashRedis {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): UpstashRedis | null {
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    return url && token ? new UpstashRedis(url, token) : null;
  }

  async command(...args: (string | number)[]): Promise<unknown> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(`Upstash error: ${body.error ?? res.status}`);
    return body.result;
  }
}
