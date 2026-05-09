/**
 * Without OPENAI_API_KEY: lightweight keyword / pattern extraction.
 * With key: optional upgrade path (not required for laptop demo).
 */
export async function parseDistressMessage(text) {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
        try {
            return await parseWithOpenAI(text, key);
        }
        catch {
            return parseHeuristic(text);
        }
    }
    return parseHeuristic(text);
}
async function parseWithOpenAI(text, apiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You extract structured maritime distress fields. Return JSON only with keys:
severity (low|medium|high|critical), summary (short), category (string), injuries (number or null), damageEstimate (string or null).`,
                },
                { role: "user", content: text },
            ],
        }),
    });
    if (!res.ok)
        throw new Error(`openai ${res.status}`);
    const body = (await res.json());
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    const obj = JSON.parse(raw);
    const severityRaw = String(obj.severity ?? "medium").toLowerCase();
    const severity = severityRaw === "low" ||
        severityRaw === "medium" ||
        severityRaw === "high" ||
        severityRaw === "critical"
        ? severityRaw
        : "medium";
    return {
        severity,
        summary: String(obj.summary ?? text.slice(0, 240)),
        category: String(obj.category ?? "unspecified"),
        injuries: typeof obj.injuries === "number"
            ? obj.injuries
            : obj.injuries == null
                ? null
                : Number(obj.injuries) || null,
        damageEstimate: obj.damageEstimate == null ? null : String(obj.damageEstimate),
    };
}
export function distressSeverityScore(s) {
    const base = s.severity === "critical"
        ? 100
        : s.severity === "high"
            ? 85
            : s.severity === "medium"
                ? 65
                : 45;
    const inj = typeof s.injuries === "number" ? Math.min(20, s.injuries) * 2 : 0;
    return Math.min(100, base + inj);
}
function parseHeuristic(text) {
    const lower = text.toLowerCase();
    let severity = "medium";
    if (/\b(fire|sinking|mayday|capsiz|abandon|explosion|collision|breach)\b/.test(lower)) {
        severity = "critical";
    }
    else if (/\b(engine|steering|propulsion|blackout|flooding|leak)\b/.test(lower)) {
        severity = "high";
    }
    else if (/\b(medical|injur|casualt|crew)\b/.test(lower)) {
        severity = "high";
    }
    else if (/\b(delay|minor|slow)\b/.test(lower)) {
        severity = "low";
    }
    const injMatch = lower.match(/(\d+)\s*(injur|casualt|crew)/);
    const injuries = injMatch ? Number(injMatch[1]) : null;
    let category = "operational";
    if (/\bfire\b/.test(lower))
        category = "fire";
    else if (/\bengine\b/.test(lower))
        category = "propulsion";
    else if (/\bmedical|\binjur/.test(lower))
        category = "medical";
    else if (/\bweather|storm|wave/.test(lower))
        category = "weather";
    return {
        severity,
        summary: text.slice(0, 280),
        category,
        injuries,
        damageEstimate: /\bdamage|hole|flood/.test(lower) ? "unspecified hull/system" : null,
    };
}
