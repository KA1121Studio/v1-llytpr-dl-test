// netlify/functions/stream.js
// /api/stream?v=ID → JSON を返す

const VERCEL_WATCH = 'https://test-v1-llytpr.vercel.app/api/watch';
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
    // 1. Vercel の /api/watch/ID から詳細情報を取得
    const watchUrl = `${VERCEL_WATCH}/${encodeURIComponent(videoId)}`;
    const watchRes = await fetch(watchUrl);

    if (!watchRes.ok) {
      return {
        statusCode: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Watch API error: ${watchRes.status}`,
        }),
      };
    }

    const data = await watchRes.json();

    // 2. Netlify 経由の動画 URL を埋め込む
    const videoUrl = `/api/video?v=${encodeURIComponent(videoId)}`;

    // 3. 整形した JSON を返す
    const responseJson = {
      type: 'video',
      title: data.title || null,
      videoId: data.videoId || videoId,
      description: data.description || null,
      viewCount: data.viewCount || null,
      likeCount: data.likeCount || null,
      dateText: data.dateText || null,
      lengthSeconds: data.lengthSeconds || null,
      category: data.category || null,
      isLive: data.isLive || false,
      channel: data.channel || null,
      related: data.related || [],
      // 動画ストリームの URL（Netlify プロキシ経由）
      streamUrl: videoUrl,
      videoUrl: videoUrl,
      // 元の Vercel のストリーム URL（参考）
      originalStreamUrl: `${VERCEL_STREAM}?v=${encodeURIComponent(videoId)}`,
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify(responseJson, null, 2),
    };
  } catch (err) {
    console.error('stream error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
