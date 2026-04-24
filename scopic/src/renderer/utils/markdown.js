/**
 * Lightweight markdown renderer that converts markdown syntax to HTML.
 * Handles: headers, bold, italic, code blocks, inline code,
 * ordered/unordered lists, blockquotes, horizontal rules, and links.
 */
export function renderMarkdown(text) {
  if (!text) return "";

  let html = text;

  // Escape HTML to prevent XSS before we add our own tags
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```) - must come before inline code
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // avoid double-wrapping, handle ordered separately by checking digit pattern
  // Simple heuristic: wrap consecutive <li> not already in <ul>
  html = html.replace(
    /(?<!<ul>)(<li>(?:(?!<\/ul>)[\s\S])*?<\/li>\n?)+(?!<\/ul>)/g,
    (match) => {
      if (match.includes("<ul>")) return match;
      return `<ol>${match}</ol>`;
    }
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Line breaks: double newline -> paragraph
  html = html.replace(/\n\n+/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Single newlines within paragraphs -> <br>
  html = html.replace(/([^>])\n([^<])/g, "$1<br>$2");

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<(?:h[123]|ul|ol|pre|hr|blockquote)[^>]*>)/g, "$1");
  html = html.replace(/(<\/(?:h[123]|ul|ol|pre|hr|blockquote)>)<\/p>/g, "$1");

  return html;
}
