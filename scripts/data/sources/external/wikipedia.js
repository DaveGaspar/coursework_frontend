import { API, TTL } from '../../../core/config.js';
import { cached } from '../../../core/cache.js';
import { getJSON } from '../../../core/http.js';

export function commonsFilePage(thumbUrl) {
  const match = /\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/.exec(thumbUrl ?? '');
  return match ? `https://commons.wikimedia.org/wiki/File:${match[1]}` : null;
}

export function pageSummary(title) {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, '_'));
  return cached(`wiki:summary:${slug}`, TTL.venue, async () => {
    const json = await getJSON(`${API.wikipedia}/page/summary/${slug}`);
    if (!json || json.type === 'disambiguation') return null;
    const thumb = json.thumbnail?.source ?? null;
    const original = json.originalimage ?? null;
    // Wikimedia serves standard thumbnail steps; 1280px is one of them. Never upscale small originals.
    const image = thumb && (original?.width ?? 0) > 1280 ? thumb.replace(/\/\d+px-/, '/1280px-') : original?.source ?? thumb;
    return {
      title: json.title ?? title,
      extract: json.extract ?? null,
      image,
      imageWidth: json.thumbnail?.width ?? null,
      imageHeight: json.thumbnail?.height ?? null,
      pageUrl: json.content_urls?.desktop?.page ?? null,
      filePage: commonsFilePage(thumb),
    };
  });
}
