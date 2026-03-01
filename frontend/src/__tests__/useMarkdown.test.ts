import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../composables/useMarkdown';

describe('useMarkdown – renderMarkdown', () => {
  // ── Basic markdown rendering ──────────────────────────────────────

  it('renders bold text via **', () => {
    const html = renderMarkdown('This is **bold** text');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders italic text via *', () => {
    const html = renderMarkdown('This is *italic* text');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders inline code via backticks', () => {
    const html = renderMarkdown('Use `console.log()` here');
    expect(html).toContain('<code>console.log()</code>');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
    expect(html).toContain('const x = 1;');
  });

  it('renders strikethrough text via ~~', () => {
    const html = renderMarkdown('This is ~~deleted~~ text');
    expect(html).toContain('<del>deleted</del>');
  });

  it('renders unordered lists', () => {
    const html = renderMarkdown('- item one\n- item two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<li>item two</li>');
  });

  it('renders blockquotes', () => {
    const html = renderMarkdown('> a wise quote');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('a wise quote');
  });

  // ── HTML sanitization ─────────────────────────────────────────────

  it('strips <script> tags', () => {
    const html = renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('strips onclick attributes', () => {
    const html = renderMarkdown('<a href="#" onclick="alert(1)">click</a>');
    expect(html).not.toContain('onclick');
  });

  it('strips onerror attributes on images', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    // img is not in ALLOWED_TAGS, so it should be stripped entirely
    expect(html).not.toContain('<img');
  });

  it('strips iframe tags', () => {
    const html = renderMarkdown('<iframe src="https://evil.com"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('strips style attributes', () => {
    const html = renderMarkdown('<p style="color:red">styled</p>');
    expect(html).not.toContain('style=');
    // The <p> tag itself is allowed, content should remain
    expect(html).toContain('styled');
  });

  // ── Link safety ───────────────────────────────────────────────────

  it('adds target="_blank" to links', () => {
    const html = renderMarkdown('[click here](https://example.com)');
    expect(html).toContain('target="_blank"');
  });

  it('adds rel="noopener noreferrer" to links', () => {
    const html = renderMarkdown('[click here](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('preserves the href attribute on links', () => {
    const html = renderMarkdown('[link](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('handles empty string input', () => {
    const html = renderMarkdown('');
    // Should return empty or whitespace-only string, not throw
    expect(html.trim()).toBe('');
  });

  it('handles plain text without markdown', () => {
    const html = renderMarkdown('Just some plain text');
    expect(html).toContain('Just some plain text');
  });

  it('handles multiple paragraphs', () => {
    const html = renderMarkdown('Paragraph one\n\nParagraph two');
    // Should contain two <p> tags
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBe(2);
  });
});
