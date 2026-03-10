<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let { content = '' } = $props<{ content: string }>();

  // Parse and sanitize markdown synchronously
  let html = $derived.by(() => {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content, { async: false }) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      console.error('Error rendering markdown:', e);
      return '<p class="text-red-400">Error rendering content</p>';
    }
  });
</script>

<div class="markdown-body text-sm leading-relaxed text-white/90">
  {@html html}
</div>

<style>
  /* Scoped global styles for the injected markdown HTML */
  :global(.markdown-body p) {
    margin-bottom: 0.75rem;
  }
  
  :global(.markdown-body p:last-child) {
    margin-bottom: 0;
  }

  :global(.markdown-body pre) {
    background-color: rgba(0, 0, 0, 0.4);
    padding: 0.75rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px string rgba(255, 255, 255, 0.1);
  }

  :global(.markdown-body code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    background-color: rgba(0, 0, 0, 0.3);
    padding: 0.15rem 0.3rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }

  :global(.markdown-body pre code) {
    background-color: transparent;
    padding: 0;
    font-size: 0.9em;
  }

  :global(.markdown-body ul) {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.markdown-body ol) {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.markdown-body blockquote) {
    border-left: 3px solid rgba(255, 255, 255, 0.3);
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    font-style: italic;
    color: rgba(255, 255, 255, 0.7);
  }

  :global(.markdown-body a) {
    color: #818cf8; /* indigo-400 */
    text-decoration: none;
  }
  
  :global(.markdown-body a:hover) {
    text-decoration: underline;
  }
</style>
