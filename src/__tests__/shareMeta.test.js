import { describe, it, expect } from 'vitest'
import { injectShareMeta, shareCopy } from '../../server/shareMeta.js'

const BASE = `<!doctype html><html><head>
    <title>FreshMatch</title>
    <meta name="description" content="generic desc" />
    <meta property="og:title" content="FreshMatch" />
    <meta property="og:description" content="generic desc" />
    <meta property="og:image" content="/brand-shield.png" />
    <meta name="twitter:title" content="FreshMatch" />
    <meta name="twitter:description" content="generic desc" />
    <meta name="twitter:image" content="/brand-shield.png" />
  </head><body></body></html>`

describe('injectShareMeta', () => {
  it('replaces title, og, and twitter tags with personalized values', () => {
    const out = injectShareMeta(BASE, {
      title: 'Amir matches',
      description: '14 colleges',
      url: 'https://ex.com/r/abc',
      image: 'https://ex.com/brand-shield.png',
    })
    expect(out).toContain('<title>Amir matches</title>')
    expect(out).toContain('property="og:title" content="Amir matches"')
    expect(out).toContain('property="og:description" content="14 colleges"')
    expect(out).toContain('property="og:image" content="https://ex.com/brand-shield.png"')
    expect(out).toContain('name="twitter:title" content="Amir matches"')
    // og:url isn't in the base template → must be inserted
    expect(out).toContain('property="og:url" content="https://ex.com/r/abc"')
    // generic copy fully replaced
    expect(out).not.toContain('content="generic desc"')
  })

  it('HTML-escapes values so a crafted name cannot inject markup', () => {
    const out = injectShareMeta(BASE, {
      title: '"><script>alert(1)</script>',
      description: 'd', url: 'u', image: 'i',
    })
    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('&quot;&gt;')
  })

  it('does not mis-handle a literal $ in a value', () => {
    const out = injectShareMeta(BASE, { title: 'A$AP price $5', description: 'd', url: 'u', image: 'i' })
    expect(out).toContain('<title>A$AP price $5</title>')
  })
})

describe('shareCopy', () => {
  it('counts schools + dream schools and uses the first name', () => {
    const { title, description } = shareCopy('Dilnoza', { schools: [1, 2, 3], dreamSchools: [1] })
    expect(title).toBe("Dilnoza's college matches · FreshMatch")
    expect(description).toContain('matched with 4 colleges')
  })

  it('falls back gracefully with no name / empty output', () => {
    const { title, description } = shareCopy('', {})
    expect(title).toContain('A student')
    expect(description).toContain('A student')
  })
})
