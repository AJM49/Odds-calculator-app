// Netlify Function: Apihorseracing proxy — Today's Card + settlement.
//
// The browser never sees the API key. This function holds it in the
// APIHORSERACING_KEY env var, forwards to api.apihorseracing.com, and caches
// responses in memory so the 50-lookups/day free tier is not burned by
// every page load.
//
// GET /.netlify/functions/apihorseracing?action=racecards&date=YYYY-MM-DD
// GET /.netlify/functions/apihorseracing?action=race&id=<race_id>
// GET /.netlify/functions/apihorseracing?action=results&date=YYYY-MM-DD
// GET /.netlify/functions/apihorseracing?action=result&id=<race_id>
//
// Upstream API: api.apihorseracing.com/v1 (Apihorseracing), key in the
// X-API-Key header. Every upstream response is { meta, data }; only `data`
// is passed through to the front end.
//
// Free key window: yesterday, today, and ahead. A date outside the window
// is refused upstream as outside_plan_window — that error is passed through
// with its message, never answered with an empty card.

const UPSTREAM_BASE = "https://api.apihorseracing.com/v1";

// In-memory cache: key -> { expiresAt, body }. Netlify Functions are
// stateless across cold starts, so this is a best-effort quota saver,
// not a guarantee. Racecards/results change slowly; a single race is
// fresher, so it gets a shorter TTL.
const CACHE = new Map();
const TTL = {
  racecards: 10 * 60 * 1000,
  results: 10 * 60 * 1000,
  race: 3 * 60 * 1000,
  result: 10 * 60 * 1000,
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
        "X-API-Key": apiKey,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = null;
    }
    if (!res.ok) {
      const err = body && body.error;
      return {
        ok: false,
        status: res.status,
        error:
          (err && (err.message || err.code)) ||
          `Upstream request failed (${res.status}).`,
      };
    }
    if (!body || !("data" in body)) {
      return { ok: false, status: 502, error: "Upstream response had no data." };
    }
    return { ok: true, status: 200, data: body.data };
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
  const apiKey = process.env.APIHORSERACING_KEY || "";
  if (!apiKey) {
    return jsonResponse(503, {
      error: "not_configured",
      message: "APIHORSERACING_KEY is not set on the site. The app will show the labeled demo card until it is configured.",
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
    upstreamPath = `/racecards/${date}`;
    ttl = TTL.racecards;
  } else if (action === "results") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse(400, { error: "bad_date", message: "Pass date as YYYY-MM-DD." });
    }
    upstreamPath = `/results/${date}`;
    ttl = TTL.results;
  } else if (action === "race") {
    if (!/^rc_[A-Za-z0-9]+$/.test(id)) {
      return jsonResponse(400, { error: "bad_id", message: "Pass a race id like rc_...." });
    }
    upstreamPath = `/races/${id}`;
    ttl = TTL.race;
  } else if (action === "result") {
    if (!/^rc_[A-Za-z0-9]+$/.test(id)) {
      return jsonResponse(400, { error: "bad_id", message: "Pass a race id like rc_...." });
    }
    upstreamPath = `/races/${id}/result`;
    ttl = TTL.result;
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
