import { describe, it, expect, beforeEach } from 'vitest'
import { reportPage } from './report'

describe('report', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
  })

  it('mounts and renders the report page structure', async () => {
    await reportPage.mount(container)
    expect(container.querySelector('.report')).toBeTruthy()
  })

  it('renders report with content container', async () => {
    await reportPage.mount(container)
    const content = container.querySelector('#report-content')
    expect(content).toBeTruthy()
  })

  it('handles report mounting and async loading', async () => {
    await reportPage.mount(container)
    // Wait for async API call to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify the report structure exists
    const report = container.querySelector('.report')
    const content = container.querySelector('#report-content')
    expect(report).toBeTruthy()
    expect(content).toBeTruthy()
    // Either error or success content should be there
    expect(content?.innerHTML.length).toBeGreaterThan(0)
  })
})
