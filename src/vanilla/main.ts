import './styles.css'

type VanillaView = 'landing' | 'workspace' | 'team' | 'login'

interface ViewOption {
  id: VanillaView
  label: string
  path: string
  note: string
}

const views: ViewOption[] = [
  {
    id: 'landing',
    label: 'Landing',
    path: '/quantum-visuals/Landing.html',
    note: 'Exact static visual reference for the drone swarm landing page.',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    path: '/quantum-visuals/Workspace.html',
    note: 'Exact static workspace reference with the terrain background and mission grid.',
  },
  {
    id: 'team',
    label: 'Team',
    path: '/quantum-visuals/Team.html',
    note: 'Exact static team page reference with the neural network background.',
  },
  {
    id: 'login',
    label: 'Login',
    path: '/quantum-visuals/login.html',
    note: 'Exact static login reference with the glass card and torus-knot scene.',
  },
]

function getInitialView(): VanillaView {
  const hash = window.location.hash.replace('#', '')
  if (views.some((view) => view.id === hash)) {
    return hash as VanillaView
  }
  return 'landing'
}

function render(viewId: VanillaView) {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) {
    return
  }

  const active = views.find((view) => view.id === viewId) ?? views[0]

  root.innerHTML = `
    <div class="vanilla-shell">
      <aside class="sidebar">
        <div class="brand-block">
          <div class="eyebrow">Vanilla TypeScript Lab</div>
          <h1>Quantum Visuals</h1>
          <p>
            This is a separate non-React runner for the exact HTML references.
            It exists to validate the intended visual behavior in isolation.
          </p>
        </div>

        <nav class="view-list">
          ${views
            .map(
              (view) => `
                <button class="view-button ${view.id === active.id ? 'is-active' : ''}" data-view="${view.id}">
                  <span>${view.label}</span>
                  <small>${view.path.replace('/quantum-visuals/', '')}</small>
                </button>
              `,
            )
            .join('')}
        </nav>

        <div class="info-card">
          <div class="card-label">Current View</div>
          <strong>${active.label}</strong>
          <p>${active.note}</p>
        </div>

        <div class="info-card">
          <div class="card-label">Why This Exists</div>
          <p>
            Yes, vanilla and TypeScript work together perfectly well. This separate
            entry lets you compare raw visuals against the React implementation
            without changing the live app architecture.
          </p>
        </div>

        <div class="footer-links">
          <a href="/" target="_blank" rel="noreferrer">Open React App</a>
          <a href="${active.path}" target="_blank" rel="noreferrer">Open Raw HTML</a>
        </div>
      </aside>

      <main class="preview-area">
        <header class="preview-header">
          <div>
            <div class="card-label">Preview</div>
            <h2>${active.label}</h2>
          </div>
          <div class="header-actions">
            <a href="${active.path}" target="_blank" rel="noreferrer">Open Direct</a>
            <a href="/" target="_blank" rel="noreferrer">Back to React</a>
          </div>
        </header>

        <div class="preview-frame-wrap">
          <iframe
            class="preview-frame"
            title="${active.label} Preview"
            src="${active.path}"
          ></iframe>
        </div>
      </main>
    </div>
  `

  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.view as VanillaView
      window.location.hash = next
      render(next)
    })
  })
}

window.addEventListener('hashchange', () => {
  render(getInitialView())
})

render(getInitialView())
