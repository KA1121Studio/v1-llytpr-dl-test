// netlify/functions/video.js
// /api/video?v=ID → Vercel の /api/stream?v=ID にプロキシして mp4 を返す

const VERCEL_STREAM = 'https://test-v1-llytpr.vercel.app/api/stream';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const videoId = event.queryStringParameters?.v;

  if (!videoId) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing parameter: v' }),
    };
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid video ID' }),
    };
  }

  try {
    // Range ヘッダーを引き継ぐ（シーク再生対応）
    const rangeHeader = event.headers?.range || event.headers?.Range;
    const fetchHeaders = {};
    if (rangeHeader) fetchHeaders.Range = rangeHeader;

    const streamUrl = `${VERCEL_STREAM}?v=${encodeURIComponent(videoId)}`;
    const streamRes = await fetch(streamUrl, { headers: fetchHeaders });

    if (!streamRes.ok && streamRes.status !== 206) {
      return {
        statusCode: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Stream API error: ${streamRes.status}` }),
      };
    }

    const arrayBuffer = await streamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const responseHeaders = {
      ...headers,
      'Content-Type': 'video/mp4',
      'Content-Length': buffer.length.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    };

    const contentRange = streamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    return {
      statusCode: streamRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('video error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
