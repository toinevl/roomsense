import { describe, it, expect, beforeEach } from 'vitest'
import { initDisclosure } from './navDisclosures'

function buildHiddenAttrFixture() {
  const button = document.createElement('button')
  const panel = document.createElement('ul')
  panel.hidden = true
  const link = document.createElement('a')
  link.href = '#target'
  panel.appendChild(link)
  document.body.appendChild(button)
  document.body.appendChild(panel)
  return { button, panel, link }
}

describe('initDisclosure (hidden-attribute mode)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('starts closed and opens on button click', () => {
    const { button, panel } = buildHiddenAttrFixture()
    const handle = initDisclosure(button, panel)

    expect(handle.isOpen()).toBe(false)
    expect(panel.hidden).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')

    button.click()

    expect(handle.isOpen()).toBe(true)
    expect(panel.hidden).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggles closed again on a second button click', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)

    button.click()
    button.click()

    expect(panel.hidden).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and returns focus to the button', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
  })

  it('closes when a click happens outside the button and panel', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(panel.hidden).toBe(true)
  })

  it('closes when a link inside the panel is clicked', () => {
    const { button, panel, link } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(panel.hidden).toBe(true)
  })
})

describe('initDisclosure (openClass mode)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('toggles a CSS class instead of the hidden attribute, and never touches hidden', () => {
    const button = document.createElement('button')
    const panel = document.createElement('nav')
    document.body.appendChild(button)
    document.body.appendChild(panel)
    const handle = initDisclosure(button, panel, { openClass: 'nav-open' })

    expect(handle.isOpen()).toBe(false)
    expect(panel.classList.contains('nav-open')).toBe(false)
    expect(panel.hidden).toBe(false)

    button.click()

    expect(handle.isOpen()).toBe(true)
    expect(panel.classList.contains('nav-open')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
  })
})
