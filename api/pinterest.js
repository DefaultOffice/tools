// Pinterest board proxy for tools/pinterest-downloader
//
// Browsers can't call Pinterest directly (CORS), so this function does the
// lookups server-side and hands back plain JSON. Request format mirrors
// gallery-dl's Pinterest extractor (resource API, unauthenticated, public boards).
//
//   GET /api/pinterest?action=board&url=<board or pin.it url>
//   GET /api/pinterest?action=pins&boardId=<id>[&sectionId=<id>][&bookmark=<b>]
//   GET /api/pinterest?action=sections&boardId=<id>[&bookmark=<b>]
//   GET /api/pinterest?action=image&url=<https://i.pinimg.com/...>

const ROOT = 'https://www.pinterest.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function apiHeaders() {
    const csrf = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return {
        'User-Agent': UA,
        'Accept': 'application/json, text/javascript, */*, q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'X-APP-VERSION': 'a89153f',
        'X-Pinterest-AppState': 'active',
        'X-Pinterest-PWS-Handler': 'www/[username].js',
        'Cookie': `csrftoken=${csrf}`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    };
}

class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

async function callResource(resource, options) {
    const params = new URLSearchParams({
        data: JSON.stringify({ options }),
        source_url: '',
    });
    const res = await fetch(`${ROOT}/resource/${resource}Resource/get/?${params}`, {
        headers: apiHeaders(),
    });
    if (res.status === 404) throw new HttpError(404, 'Board not found — check the link, and that the board is public.');
    if (!res.ok) throw new HttpError(502, `Pinterest returned ${res.status}`);
    return res.json();
}

function nextBookmark(data) {
    const b = data && data.resource && data.resource.options && data.resource.options.bookmarks;
    if (!b || !b.length || b[0] === '-end-' || String(b[0]).startsWith('Y2JOb25lO')) return null;
    return b[0];
}

// pin.it/xxxx → full pinterest URL
async function resolveShortLink(url) {
    const m = url.match(/pin\.it\/([^/?#]+)/i);
    if (!m) return url;
    const res = await fetch(`https://api.pinterest.com/url_shortener/${m[1]}/redirect/`, {
        redirect: 'manual',
        headers: { 'User-Agent': UA },
    });
    const loc = res.headers.get('location');
    if (!loc) throw new HttpError(404, 'Could not resolve that pin.it link.');
    return loc;
}

// Returns { user, board, section } from a pinterest.* board URL
function parseBoardUrl(url) {
    let u;
    try { u = new URL(url.startsWith('http') ? url : `https://${url}`); }
    catch { return null; }
    if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts.length < 2 || parts[0] === 'pin' || parts[0] === 'search') return null;
    return { user: parts[0], board: parts[1], section: parts[2] || null };
}

// All downloadable image URLs for a pin (carousels give several)
function pinImages(pin) {
    const urls = [];
    const slots = pin.carousel_data && pin.carousel_data.carousel_slots;
    if (Array.isArray(slots) && slots.length) {
        for (const slot of slots) {
            const imgs = slot.images || {};
            const key = Object.keys(imgs)[0];
            if (key && imgs[key] && imgs[key].url) {
                urls.push(imgs[key].url.replace(`/${key}/`, '/originals/'));
            }
        }
    }
    if (!urls.length && pin.images) {
        const best = pin.images.orig || pin.images['736x'] || Object.values(pin.images)[0];
        if (best && best.url) urls.push(best.url);
    }
    return urls;
}

async function handleBoard(req) {
    const raw = String(req.query.url || '').trim();
    if (!raw) throw new HttpError(400, 'Paste a Pinterest board link.');
    const full = await resolveShortLink(raw);
    const parsed = parseBoardUrl(full);
    if (!parsed) throw new HttpError(400, 'That doesn’t look like a board link (single pins aren’t supported).');

    const data = await callResource('Board', {
        slug: parsed.board, username: parsed.user, field_set_key: 'detailed',
    });
    const board = data.resource_response && data.resource_response.data;
    if (!board || !board.id) throw new HttpError(404, 'Board not found — check the link, and that the board is public.');

    let section = null;
    if (parsed.section) {
        const s = await callResource('BoardSection', {
            board_slug: parsed.board, section_slug: parsed.section, username: parsed.user,
        });
        const sd = s.resource_response && s.resource_response.data;
        if (sd && sd.id) section = { id: sd.id, title: sd.title || parsed.section, pinCount: sd.pin_count || 0 };
    }

    return {
        id: board.id,
        name: board.name || parsed.board,
        owner: (board.owner && board.owner.username) || parsed.user,
        pinCount: board.pin_count || 0,
        sectionCount: board.section_count || 0,
        section,
    };
}

async function handlePins(req) {
    const { boardId, sectionId, bookmark } = req.query;
    if (!boardId && !sectionId) throw new HttpError(400, 'Missing boardId');
    const options = sectionId
        ? { section_id: String(sectionId), page_size: 50 }
        : { board_id: String(boardId), field_set_key: 'react_grid_pin', prepend: false, page_size: 50 };
    if (bookmark) options.bookmarks = [String(bookmark)];

    const data = await callResource(sectionId ? 'BoardSectionPins' : 'BoardFeed', options);
    let results = (data.resource_response && data.resource_response.data) || [];
    if (!Array.isArray(results)) results = results.results || [];

    const pins = results
        .filter(p => p && p.type !== 'story' && (p.images || p.carousel_data))
        .map(p => ({ id: String(p.id), images: pinImages(p) }))
        .filter(p => p.images.length);

    return { pins, bookmark: nextBookmark(data) };
}

async function handleSections(req) {
    const { boardId, bookmark } = req.query;
    if (!boardId) throw new HttpError(400, 'Missing boardId');
    const options = { board_id: String(boardId) };
    if (bookmark) options.bookmarks = [String(bookmark)];
    const data = await callResource('BoardSections', options);
    let results = (data.resource_response && data.resource_response.data) || [];
    if (!Array.isArray(results)) results = results.results || [];
    return {
        sections: results.map(s => ({ id: String(s.id), title: s.title || s.slug || String(s.id) })),
        bookmark: nextBookmark(data),
    };
}

async function handleImage(req, res) {
    let u;
    try { u = new URL(String(req.query.url || '')); } catch { throw new HttpError(400, 'Bad image url'); }
    if (u.protocol !== 'https:' || u.hostname !== 'i.pinimg.com') throw new HttpError(400, 'Only i.pinimg.com images');
    const img = await fetch(u.href, { headers: { 'User-Agent': UA, 'Referer': `${ROOT}/` } });
    if (!img.ok) throw new HttpError(img.status === 404 ? 404 : 502, `Image fetch failed (${img.status})`);
    const buf = Buffer.from(await img.arrayBuffer());
    res.setHeader('Content-Type', img.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(buf);
}

module.exports = async function handler(req, res) {
    try {
        const action = req.query.action;
        if (action === 'image') return await handleImage(req, res);

        let out;
        if (action === 'board') out = await handleBoard(req);
        else if (action === 'pins') out = await handlePins(req);
        else if (action === 'sections') out = await handleSections(req);
        else throw new HttpError(400, 'Unknown action');

        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(out);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Something went wrong' });
    }
};

// Exposed for local tests
module.exports._internal = { parseBoardUrl, pinImages, nextBookmark };
