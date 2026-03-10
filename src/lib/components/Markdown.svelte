<script lang="ts">
  import { renderMarkdown, applyHighlighting } from '$lib/services/markdown/renderer';
  import type { Action } from 'svelte/action';

  let { content = '' } = $props<{ content: string }>();

  let html = $derived(renderMarkdown(content));

  /** Inject sanitized HTML and apply syntax highlighting */
  const renderHtml: Action<HTMLElement, string> = (node, contentHtml) => {
    node.innerHTML = contentHtml;
    applyHighlighting(node);

    return {
      update(newHtml: string) {
        node.innerHTML = newHtml;
        applyHighlighting(node);
      }
    };
  };
</script>

<div class="markdown-body text-sm leading-relaxed text-white/90" use:renderHtml={html}></div>

<style>
  :global(.markdown-body p) {
    margin-bottom: 0.75rem;
  }

  :global(.markdown-body p:last-child) {
    margin-bottom: 0;
  }

  /* Shiki-highlighted and fallback code blocks */
  :global(.markdown-body pre),
  :global(.markdown-body .shiki) {
    background-color: rgba(0, 0, 0, 0.4) !important;
    padding: 0.75rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.markdown-body .shiki code) {
    background-color: transparent !important;
    padding: 0;
    font-size: 0.85em;
  }

  :global(.markdown-body code) {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
      monospace;
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
    color: #818cf8;
    text-decoration: none;
  }

  :global(.markdown-body a:hover) {
    text-decoration: underline;
  }

  :global(.markdown-body h1) {
    font-size: 1.25em;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  :global(.markdown-body h2) {
    font-size: 1.15em;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  :global(.markdown-body h3) {
    font-size: 1.05em;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  :global(.markdown-body hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 1rem 0;
  }

  :global(.markdown-body table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.75rem;
    font-size: 0.85em;
  }

  :global(.markdown-body th),
  :global(.markdown-body td) {
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.35rem 0.5rem;
    text-align: left;
  }

  :global(.markdown-body th) {
    background-color: rgba(255, 255, 255, 0.05);
    font-weight: 600;
  }

  /* Code block wrapper with copy button */
  :global(.markdown-body .code-block-wrapper) {
    position: relative;
  }

  :global(.markdown-body .copy-btn) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    z-index: 1;
  }

  :global(.markdown-body .copy-btn:hover) {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
