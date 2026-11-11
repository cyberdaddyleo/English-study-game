/*
 * 冰屋单词大作战 · AI 接口中转（Cloudflare Worker）
 * 用途：有的 AI 厂商不允许网页直接调用接口（跨域被拦），部署这个 Worker 后，
 *      在游戏「AI 设置」里把接口地址改成  https://你的worker域名/厂商名  即可。
 *      例：https://igloo-ai.xxx.workers.dev/deepseek
 * 安全：Worker 不保存任何 Key，只把请求原样转发给对应厂商。
 *      建议在 Worker 的环境变量里设置 ALLOW_ORIGIN=https://你的游戏域名，防止别人借用。
 */
var TARGETS = {
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  ark: 'https://ark.cn-beijing.volces.com/api/v3',
  moonshot: 'https://api.moonshot.cn/v1'
};

export default {
  async fetch(req, env) {
    var origin = req.headers.get('Origin') || '';
    var allow = (env && env.ALLOW_ORIGIN) || '*';
    var cors = {
      'Access-Control-Allow-Origin': allow === '*' ? '*' : allow,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (allow !== '*' && origin && origin !== allow) return new Response('forbidden', { status: 403, headers: cors });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return new Response('only POST', { status: 405, headers: cors });

    var url = new URL(req.url);
    var parts = url.pathname.split('/').filter(Boolean);
    var base = TARGETS[parts.shift()];
    if (!base) return new Response('unknown provider', { status: 404, headers: cors });

    var headers = new Headers(req.headers);
    ['origin', 'referer', 'cookie', 'host', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'].forEach(function (h) { headers.delete(h); });
    var upstream = await fetch(base + '/' + parts.join('/') + url.search, { method: 'POST', headers: headers, body: req.body });

    var out = new Response(upstream.body, upstream);
    Object.keys(cors).forEach(function (k) { out.headers.set(k, cors[k]); });
    return out;
  }
};
