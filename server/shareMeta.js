// Server-side Open Graph / Twitter meta injection for the shared results page.
//
// Link-unfurl crawlers (WhatsApp, Telegram, iMessage, Slack, Facebook, Twitter)
// don't run JavaScript, so they only ever see the static index.html <head>. To
// give a shared /r/:token link a personalized preview we rewrite that <head>'s
// meta before serving — while the SPA still boots and renders the full
// interactive page client-side for real visitors.

// Escape for safe insertion into HTML text / double-quoted attributes. The name
// is user-supplied, so this is the trust boundary — never interpolate raw.
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Replace (or insert before </head>) one <meta {attr}="{key}" content="..."> tag.
// A function replacement is used so a literal '$' in the value isn't treated as a
// replacement pattern.
function setMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=)"[^"]*"`, 'i')
  if (re.test(html)) return html.replace(re, (_m, p1) => `${p1}"${content}"`)
  const tag = `    <meta ${attr}="${key}" content="${content}" />\n`
  return html.replace(/<\/head>/i, () => `${tag}  </head>`)
}

// Inject personalized share metadata. Callers pass raw strings; everything is
// HTML-escaped here.
export function injectShareMeta(html, { title, description, url, image }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(url)
  const img = escapeHtml(image)

  let out = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${t}</title>`)
  out = setMeta(out, 'name', 'description', d)
  out = setMeta(out, 'property', 'og:title', t)
  out = setMeta(out, 'property', 'og:description', d)
  out = setMeta(out, 'property', 'og:image', img)
  out = setMeta(out, 'property', 'og:url', u)
  out = setMeta(out, 'name', 'twitter:title', t)
  out = setMeta(out, 'name', 'twitter:description', d)
  out = setMeta(out, 'name', 'twitter:image', img)
  return out
}

// Build the {title, description} pair for a shared result from its stored payload.
export function shareCopy(name, output) {
  const safeName = (name || '').trim() || 'A student'
  const out = output || {}
  const count =
    (Array.isArray(out.schools) ? out.schools.length : 0) +
    (Array.isArray(out.dreamSchools) ? out.dreamSchools.length : 0)
  const title = `${safeName}'s college matches · FreshMatch`
  const description = count > 0
    ? `${safeName} matched with ${count} colleges. Find out where you actually fit — takes 5 minutes.`
    : `See ${safeName}'s college match results. Find out where you actually fit — takes 5 minutes.`
  return { title, description }
}
