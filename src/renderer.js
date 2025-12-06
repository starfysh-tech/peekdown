// Initialize markdown-it with custom fence renderer
const md = window.markdownit({ html: true });

// Store default fence renderer
const default_fence = md.renderer.rules.fence.bind(md.renderer.rules);

// Custom fence: convert ```mermaid to <div class="mermaid">
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }
  return default_fence(tokens, idx, options, env, self);
};

// Theme detection
function get_prefers_dark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply_theme() {
  const prefers_dark = get_prefers_dark();
  document.body.classList.toggle('theme-dark', prefers_dark);
  document.body.classList.toggle('theme-light', !prefers_dark);
  return prefers_dark;
}

// Initialize mermaid
function init_mermaid(prefers_dark) {
  mermaid.initialize({
    startOnLoad: false,
    theme: prefers_dark ? 'dark' : 'neutral',
    securityLevel: 'strict',
    flowchart: {
      defaultRenderer: 'elk',
      htmlLabels: false,
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 20
    },
    elk: {
      mergeEdges: false,
      nodePlacementStrategy: 'SIMPLE'
    }
  });
}

// Render mermaid diagrams with error handling
async function render_mermaid() {
  const mermaid_elements = document.querySelectorAll('.mermaid');

  for (const element of mermaid_elements) {
    const content = element.textContent;
    element.setAttribute('data-original', content);

    try {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, content);
      element.innerHTML = svg;
    } catch (err) {
      element.innerHTML = `<div class="mermaid-error">Diagram error: ${err.message}</div>`;
    }
  }
}

// Re-render mermaid on theme change
async function rerender_mermaid_with_theme() {
  const prefers_dark = get_prefers_dark();
  init_mermaid(prefers_dark);

  const mermaid_elements = document.querySelectorAll('.mermaid');
  for (const element of mermaid_elements) {
    const original = element.getAttribute('data-original');
    if (original) {
      element.textContent = original;
    }
  }

  await render_mermaid();
}

// Render markdown content
async function render_content(content) {
  const content_element = document.getElementById('content');

  // Parse markdown
  const html = md.render(content);

  // Sanitize with DOMPurify
  const clean_html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['div'],
    ADD_ATTR: ['class', 'data-original']
  });

  // Inject to DOM
  content_element.innerHTML = clean_html;

  // Render mermaid diagrams
  await render_mermaid();
}

// Show error message
function show_error(message) {
  const content_element = document.getElementById('content');
  content_element.innerHTML = `<div class="error-message">${DOMPurify.sanitize(message)}</div>`;
}

// Initialize
function init() {
  const prefers_dark = apply_theme();
  init_mermaid(prefers_dark);

  // Listen for theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    apply_theme();
    await rerender_mermaid_with_theme();
  });

  // Receive file content from main process
  window.electronAPI.onFileContent(async (content, filename) => {
    if (filename) {
      document.getElementById('filename').textContent = filename;
    }
    await render_content(content);
  });

  // Receive errors from main process
  window.electronAPI.onError((message) => {
    show_error(message);
  });
}

init();
