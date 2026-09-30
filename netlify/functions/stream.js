// netlify/functions/stream.js
// /api/stream?v=ID → Invidious 互換の JSON を返す

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
    // 1) Vercel の /api/watch/ID から詳細情報を取得
    const watchUrl = `${VERCEL_WATCH}/${encodeURIComponent(videoId)}`;
    const watchRes = await fetch(watchUrl);

    if (!watchRes.ok) {
      return {
        statusCode: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Watch API error: ${watchRes.status}` }),
      };
    }

    const data = await watchRes.json();

    // 2) Netlify 経由の動画 URL
    const videoUrl = `/api/video?v=${encodeURIComponent(videoId)}`;

    // 3) Invidious 互換の formatStreams を構築
    //    フロントは f.type.includes("video/mp4")
    //    かつ (f.qualityLabel.includes("360") || f.itag === 18)
    //    を探すため、それにマッチさせる
    const formatStreams = [
      {
        itag: '18',
        type: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
        quality: 'medium',
        qualityLabel: '360p',
        resolution: '360p',
        size: '640x360',
        bitrate: '444226',
        fps: 25,
        container: 'mp4',
        encoding: 'h264',
        url: videoUrl,
        hasAudio: true,
        hasVideo: true,
      },
    ];

    // 4) レスポンス JSON を構築
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

      // フロントが参照するプロパティ
      formatStreams,
      adaptiveFormats: [],

      // 各種 URL（複数のキーで参照可能に）
      streamUrl: videoUrl,
      videoUrl: videoUrl,
      defaultStreamUrl: videoUrl,
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
