// 流式 fetch 带进度回调。gzip 下 Content-Length 是压缩后字节数，
// 所以进度是"下载的压缩字节 / 总压缩字节"，近似但对用户够用。

export interface ProgressInfo {
  url: string;
  loaded: number;   // 已下载字节
  total: number;    // 总字节（Content-Length，可能为 0）
  done: boolean;
}

/** 流式下载 URL 的文本内容，onProgress 在每个 chunk 到达时被调用。 */
export async function streamFetchText(
  url: string,
  onProgress?: (p: ProgressInfo) => void,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;

  if (!res.body) {
    // 不支持 stream 的降级：text.length 是字符数，要按真实字节上报
    const text = await res.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    onProgress?.({ url, loaded: bytes, total: total || bytes, done: true });
    return text;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ url, loaded, total, done: false });
    }
  }
  onProgress?.({ url, loaded, total: total || loaded, done: true });

  // 合并 chunks 为 string
  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/** 流式 fetch JSON 的便捷封装 */
export async function streamFetchJson<T>(
  url: string,
  onProgress?: (p: ProgressInfo) => void,
): Promise<T> {
  const text = await streamFetchText(url, onProgress);
  return JSON.parse(text) as T;
}

/** 聚合多个下载的进度，onAggregate 每次有任何子任务进度时被调用。 */
export function aggregateProgress(
  urls: string[],
  onAggregate: (p: { loaded: number; total: number; ratio: number; done: boolean }) => void,
): (p: ProgressInfo) => void {
  const state = new Map<string, { loaded: number; total: number; done: boolean }>();
  for (const u of urls) state.set(u, { loaded: 0, total: 0, done: false });

  return (p: ProgressInfo) => {
    state.set(p.url, { loaded: p.loaded, total: p.total, done: p.done });
    let loaded = 0;
    let total = 0;
    let allDone = true;
    for (const v of state.values()) {
      loaded += v.loaded;
      total += v.total || v.loaded; // 若 total 未知，用当前 loaded 占位
      if (!v.done) allDone = false;
    }
    const ratio = total > 0 ? Math.min(loaded / total, 1) : 0;
    onAggregate({ loaded, total, ratio, done: allDone });
  };
}

/** 人类可读的字节大小：1.8 MB / 340 KB */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
