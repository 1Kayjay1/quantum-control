const body = document.body
const switcher = document.getElementById('prototype-switcher')

function setPrototype(next) {
  body.dataset.prototype = next
  for (const button of switcher.querySelectorAll('[data-prototype-target]')) {
    button.classList.toggle('is-active', button.dataset.prototypeTarget === next)
  }
}

switcher.addEventListener('click', (event) => {
  const button = event.target.closest('[data-prototype-target]')
  if (!button) {
    return
  }

  setPrototype(button.dataset.prototypeTarget)
})

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]')
  if (!toggle) {
    return
  }

  const target = toggle.dataset.toggle
  if (target === 'rail') {
    body.classList.toggle('is-rail-collapsed')
  }
  if (target === 'inspector') {
    body.classList.toggle('is-inspector-collapsed')
  }
  if (target === 'timeline') {
    body.classList.toggle('is-timeline-collapsed')
  }
  if (target === 'telemetry') {
    body.classList.toggle('is-telemetry-collapsed')
  }
  if (target === 'debug') {
    toggle.classList.toggle('is-active')
  }
  if (target === 'topbar') {
    body.classList.toggle('is-topbar-collapsed')
  }
})

setPrototype('a')
