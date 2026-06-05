interface SearchResult {
  source: string;
  content: string;
}

interface ToolOutput {
  query: string;
  results: SearchResult[];
}

declare global {
  interface Window {
    openai?: {
      toolOutput?: ToolOutput;
    };
  }
}

function render(data: ToolOutput | undefined) {
  const root = document.getElementById("root");
  if (!root) return;

  if (!data) {
    root.innerHTML = `<div style="padding:16px;color:#888;font-family:system-ui">Caricamento...</div>`;
    return;
  }

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const accent = "#10a37f";
  const cardBg = isDark ? "#2a2a2a" : "#f8f9fa";
  const border = isDark ? "#3a3a3a" : "#e0e0e0";
  const textPrimary = isDark ? "#ffffff" : "#1a1a1a";
  const textSecondary = isDark ? "#aaaaaa" : "#666666";

  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;padding:16px">
      <div style="margin-bottom:14px">
        <div style="font-size:11px;color:${textSecondary};text-transform:uppercase;letter-spacing:1px">Ricerca</div>
        <div style="font-size:15px;font-weight:600;color:${textPrimary};margin:2px 0 4px">${escHtml(data.query)}</div>
        <div style="font-size:12px;color:${accent}">${data.results.length} risultati trovati</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${data.results.map((r) => `
          <div style="background:${cardBg};border:1px solid ${border};border-radius:8px;padding:14px">
            <div style="display:inline-block;background:${accent}22;color:${accent};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-bottom:8px">${escHtml(r.source)}</div>
            <div style="font-size:13px;color:${textPrimary};line-height:1.6">${escHtml(r.content.slice(0, 300))}${r.content.length > 300 ? "…" : ""}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Render iniziale con dati già presenti
render(window.openai?.toolOutput);

// Aggiornamento se i globals arrivano dopo
window.addEventListener("openai:set_globals", (event: Event) => {
  const detail = (event as CustomEvent).detail;
  render(detail?.globals?.toolOutput ?? window.openai?.toolOutput);
}, { passive: true });
