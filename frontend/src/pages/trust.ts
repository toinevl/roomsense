import type { Page } from './types'

const styles = `
  .trust-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
  }

  .trust-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .trust-header h1 {
    margin: 0;
    font-size: 2rem;
    color: #333;
  }

  .subtitle {
    margin: 0.5rem 0 0;
    color: #666;
    font-size: 1.125rem;
  }

  .faq {
    margin-bottom: 3rem;
  }

  .faq-item {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #eee;
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-item h3 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    color: #333;
    font-weight: 600;
  }

  .faq-item p {
    margin: 0;
    color: #555;
  }

  .faq-item a {
    color: #0066cc;
    text-decoration: none;
  }

  .faq-item a:hover {
    text-decoration: underline;
  }

  .trust-footer {
    text-align: center;
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .trust-footer h2 {
    margin-top: 0;
    font-size: 1.25rem;
    color: #333;
  }

  .trust-footer p {
    margin: 0;
    color: #666;
  }
`

export const trustPage: Page = {
  mount(container: HTMLElement) {
    // Add styles
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    // Main wrapper
    const main = document.createElement('div')
    main.className = 'trust-page'

    // Header
    const header = document.createElement('header')
    header.className = 'trust-header'

    const heading = document.createElement('h1')
    heading.textContent = 'Trust & Transparency'
    header.appendChild(heading)

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = "What RoomSense does and doesn't track"
    header.appendChild(subtitle)

    main.appendChild(header)

    // FAQ section
    const faq = document.createElement('div')
    faq.className = 'faq'

    const faqItems = [
      {
        q: "Do you track individuals?",
        a: "No. RoomSense counts occupancy only — it measures how many people are in a room at a given time. We do not collect names, IDs, badges, or any personal information.",
      },
      {
        q: "Do you have cameras or facial recognition?",
        a: "No. Data comes from Terabee People Counting sensors, which use infrared time-of-flight technology. They detect movement and body shapes, not faces or identifying features.",
      },
      {
        q: "What data is collected and stored?",
        a: "Room occupancy (count), timestamp, room name, and building location. For demonstration purposes, we also store mock calendar reservation data (subject line, organizer name, attendee count) to show how room usage compares to actual bookings.",
      },
      {
        q: "Who can see the data?",
        a: "Everyone on this page can see anonymized building-level and room-level occupancy trends. Staff and facilities teams have access to the full historical dataset to support space planning. No individual or team data is ever exposed.",
      },
      {
        q: "How long is data kept?",
        a: "Demonstration data is kept for 30 days for demo purposes. In production, retention policies would be set by your institution's IT governance and data retention requirements.",
      },
      {
        q: "Can I opt out?",
        a: "Since RoomSense counts occupancy only and does not track individuals, there is nothing to opt out of. However, institutions deploying RoomSense can choose which rooms to monitor and set their own privacy policies.",
      },
      {
        q: "How is the code reviewed?",
        a: "RoomSense is open-source. The code, architecture, and data handling are publicly reviewable. See our architecture page for details on how data flows and what is/isn't visible.",
      },
    ]

    for (const item of faqItems) {
      const section = document.createElement('section')
      section.className = 'faq-item'

      const h3 = document.createElement('h3')
      h3.textContent = item.q
      section.appendChild(h3)

      const p = document.createElement('p')
      p.textContent = item.a
      section.appendChild(p)

      faq.appendChild(section)
    }

    main.appendChild(faq)

    // Footer
    const footer = document.createElement('section')
    footer.className = 'trust-footer'

    const footerHeading = document.createElement('h2')
    footerHeading.textContent = 'Questions?'
    footer.appendChild(footerHeading)

    const footerText = document.createElement('p')
    footerText.textContent = 'If you have privacy or security concerns, please reach out. We take data trust seriously.'
    footer.appendChild(footerText)

    main.appendChild(footer)

    container.appendChild(main)
  },
}
