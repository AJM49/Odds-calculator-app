// Netlify Function: racecards proxy — Phase 1 "Today's Card".
//
// The browser never sees the RapidAPI key. This function holds it in the
// RAPIDAPI_KEY env var, forwards to the Horse Racing USA API, and caches
// responses in memory so the 50-requests/day free tier is not burned by
// every page load.
//
// GET /.netlify/functions/racecards?action=racecards&date=YYYY-MM-DD
// GET /.netlify/functions/racecards?action=race&id=<id_race>
// GET /.netlify/functions/racecards?action=results&date=YYYY-MM-DD
//
// Upstream API: horse-racing-usa.p.rapidapi.com (RapidAPI "Horse Racing USA").
// Response shape is passed through untouched; the front end normalizes it.

const UPSTREAM_HOST = "horse-racing-usa.p.rapidapi.com";
const UPSTREAM_BASE = `https://${UPSTREAM_HOST}`;

// In-memory cache: key -> { expiresAt, body }. Netlify Functions are
// stateless across cold starts, so this is a best-effort quota saver,
// not a guarantee. Racecards/results change slowly; race detail is
// fresher (odds move), so it gets a shorter TTL.
const CACHE = new Map();
const TTL = {
  racecards: 10 * 60 * 1000,
  results: 10 * 60 * 1000,
  race: 3 * 60 * 1000,
};

function jsonResponse(statusCode, body, source) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Racecard-Source": source || "live",
    },
    body: JSON.stringify(body),
  };
}

function cacheKey(action, date, id) {
  return `${action}:${date || ""}:${id || ""}`;
}

async function fetchUpstream(path, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${UPSTREAM_BASE}${path}`, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": UPSTREAM_HOST,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data && (data.message || data.error)) || `Upstream request failed (${res.status}).`,
      };
    }
    return { ok: true, status: 200, data };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err && err.name === "AbortError" ? "Upstream request timed out." : "Could not reach the race data service.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

exports.handler = async (event) => {
  const apiKey = process.env.RAPIDAPI_KEY || "";
  if (!apiKey) {
    return jsonResponse(503, {
      error: "not_configured",
      message: "RAPIDAPI_KEY is not set on the site. The app will show the labeled demo card until it is configured.",
    });
  }

  const params = (event && event.queryStringParameters) || {};
  const action = params.action || "racecards";
  const date = params.date || "";
  const id = params.id || "";

  let upstreamPath = "";
  let ttl = TTL.racecards;
  if (action === "racecards") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse(400, { error: "bad_date", message: "Pass date as YYYY-MM-DD." });
    }
    upstreamPath = `/racecards?date=${date}`;
    ttl = TTL.racecards;
  } else if (action === "results") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse(400, { error: "bad_date", message: "Pass date as YYYY-MM-DD." });
    }
    upstreamPath = `/results?date=${date}`;
    ttl = TTL.results;
  } else if (action === "race") {
    if (!/^\d+$/.test(id)) {
      return jsonResponse(400, { error: "bad_id", message: "Pass a numeric race id." });
    }
    upstreamPath = `/race/${id}`;
    ttl = TTL.race;
  } else {
    return jsonResponse(400, { error: "bad_action", message: "Unknown action." });
  }

  const key = cacheKey(action, date, id);
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse(200, { source: "cache", data: cached.body }, "cache");
  }

  const result = await fetchUpstream(upstreamPath, apiKey);
  if (!result.ok) {
    return jsonResponse(result.status, { error: "upstream_error", message: result.error });
  }

  CACHE.set(key, { expiresAt: Date.now() + ttl, body: result.data });
  return jsonResponse(200, { source: "live", data: result.data }, "live");
};
