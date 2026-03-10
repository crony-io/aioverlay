import { marked, type RendererObject } from 'marked';
import DOMPurify from 'dompurify';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

/** Supported languages for syntax highlighting */
const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  'javascript',
  'typescript',
  'python',
  'rust',
  'html',
  'css',
  'json',
  'bash',
  'shell',
  'markdown',
  'sql',
  'yaml',
  'toml',
  'svelte',
  'jsx',
  'tsx',
  'go',
  'java',
  'c',
  'cpp'
];

let highlighterInstance: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

/** Lazily initialize the Shiki highlighter singleton */
async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return highlighterInstance;

  if (!initPromise) {
    initPromise = createHighlighter({
      themes: ['github-dark-default'],
      langs: SUPPORTED_LANGUAGES
    }).then((h) => {
      highlighterInstance = h;
      return h;
    });
  }

  return initPromise;
}

/** Highlight a code block using Shiki, falls back to plain text */
async function highlightCode(code: string, lang: string): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    const resolvedLang = SUPPORTED_LANGUAGES.includes(lang as BundledLanguage)
      ? (lang as BundledLanguage)
      : 'text';

    // Load language on demand if not already loaded
    if (resolvedLang !== 'text') {
      const loadedLangs = highlighter.getLoadedLanguages();
      if (!loadedLangs.includes(resolvedLang)) {
        await highlighter.loadLanguage(resolvedLang);
      }
    }

    return highlighter.codeToHtml(code, {
      lang: resolvedLang,
      theme: 'github-dark-default'
    });
  } catch {
    // Fallback: wrap in pre/code without highlighting
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre class="shiki"><code>${escaped}</code></pre>`;
  }
}

/** Configure marked with a custom code renderer that uses Shiki */
function createRenderer(): RendererObject {
  return {
    code({ text, lang }: { text: string; lang?: string | undefined }): string {
      const language = lang || 'text';
      // Return a placeholder that will be replaced async
      const id = `shiki-${Math.random().toString(36).slice(2, 10)}`;
      // Store code block info for async processing
      pendingBlocks.set(id, { code: text, lang: language });
      const escapedCode = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div id="${id}" class="code-block-wrapper relative group">
        <button class="copy-btn absolute top-2 right-2 rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy code">Copy</button>
        <pre><code>${escapedCode}</code></pre>
      </div>`;
    }
  };
}

/** Map of placeholder IDs to their code info for async highlighting */
const pendingBlocks = new Map<string, { code: string; lang: string }>();

/** DOMPurify config: allow button elements, inline styles (for Shiki), and data-* attributes */
const SANITIZE_CONFIG = {
  ADD_TAGS: ['button'],
  ADD_ATTR: ['class', 'id', 'aria-label', 'data-bound', 'style']
};

/**
 * Render markdown content to sanitized HTML.
 * Returns HTML immediately with plain code blocks,
 * syntax highlighting is applied async via applyHighlighting.
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  pendingBlocks.clear();

  try {
    marked.use({ renderer: createRenderer() });
    const rawHtml = marked.parse(content, { async: false }) as string;
    return String(DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG));
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return '<p class="text-red-400">Error rendering content</p>';
  }
}

/**
 * Apply syntax highlighting to a container element.
 * Replaces placeholder elements with Shiki-highlighted code.
 */
export async function applyHighlighting(container: HTMLElement): Promise<void> {
  // Wire up copy buttons on all code-block-wrappers
  attachCopyHandlers(container);

  if (pendingBlocks.size === 0) return;

  const entries = [...pendingBlocks.entries()];
  pendingBlocks.clear();

  await Promise.all(
    entries.map(async ([id, { code, lang }]) => {
      const el = container.querySelector(`#${id}`);
      if (!el) return;

      const highlighted = await highlightCode(code, lang);
      // Preserve the wrapper + copy button, replace only the code content
      const copyBtn = el.querySelector('.copy-btn');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = DOMPurify.sanitize(highlighted);

      // Clear old pre/code, keep the button
      el.querySelectorAll('pre').forEach((pre) => pre.remove());
      el.querySelectorAll('.shiki-placeholder').forEach((ph) => ph.remove());

      // Append highlighted content
      while (wrapper.firstChild) {
        el.appendChild(wrapper.firstChild);
      }

      // Re-attach button at the top
      if (copyBtn) el.prepend(copyBtn);

      el.classList.remove('shiki-placeholder');
    })
  );

  // Re-attach copy handlers after highlighting replaces DOM
  attachCopyHandlers(container);
}

/** Attach click handlers to all copy buttons in a container */
function attachCopyHandlers(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.code-block-wrapper').forEach((wrapper) => {
    const btn = wrapper.querySelector<HTMLButtonElement>('.copy-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', () => {
      const codeEl = wrapper.querySelector('code');
      if (!codeEl) return;

      navigator.clipboard.writeText(codeEl.textContent ?? '').then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 1500);
      });
    });
  });
}
