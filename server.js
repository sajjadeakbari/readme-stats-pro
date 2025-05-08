const http = require('http');
const url = require('url');
const { generateStatsSVG } = require('./api/index');

const PORT = process.env.PORT || 3000;

const apiCache = new Map();
const reposCache = new Map();
const svgCache = new Map();
const SVG_CACHE_TTL = 60 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const cacheKey = JSON.stringify(query);
    const cachedSvg = svgCache.get(cacheKey);

    if (cachedSvg && (Date.now() - cachedSvg.timestamp < SVG_CACHE_TTL)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('X-Cache-Hit', 'true');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.writeHead(200);
      res.end(cachedSvg.svg);
      return;
    }

    const mockReq = { query };
    const cachesForApi = { apiCache, reposCache };

    let capturedSvg = '';
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalSetHeader = res.setHeader;
    const originalWriteHead = res.writeHead;

    let headers = {};
    let statusCode = 200;

    res.setHeader = (name, value) => {
      headers[name.toLowerCase()] = value;
    };
    res.writeHead = (sCode, sHeaders) => {
      statusCode = sCode;
      if (sHeaders) {
        for (const key in sHeaders) {
          headers[key.toLowerCase()] = sHeaders[key];
        }
      }
    };
    res.write = (chunk) => {
      capturedSvg += chunk.toString();
    };
    res.end = (chunk) => {
      if (chunk) capturedSvg += chunk.toString();

      res.write = originalWrite;
      res.end = originalEnd;
      res.setHeader = originalSetHeader;
      res.writeHead = originalWriteHead;

      if (statusCode === 200 && capturedSvg.startsWith('<svg')) {
        svgCache.set(cacheKey, { svg: capturedSvg, timestamp: Date.now() });
      }

      for (const key in headers) {
        res.setHeader(key, headers[key]);
      }
      res.writeHead(statusCode);
      res.end(capturedSvg);
    };

    await generateStatsSVG(mockReq, res, cachesForApi);
  } else if (pathname === '/stats') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const demoHtml = `...`; // برای اختصار، محتوای HTML دمو را حذف کردم. بخواهی می‌فرستم.
    res.end(demoHtml);
  } else if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('readme-stats-pro is running. Use /api or /stats.');
  } else if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`readme-stats-pro is listening on port ${PORT}`);
});
