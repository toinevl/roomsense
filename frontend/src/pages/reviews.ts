import { REVIEW_TAGS } from '@roomsense/shared'
import { apiClient } from '../lib/api'
import type { RoomReview } from '../lib/apiTypes'
import { createReviewCard } from '../components/reviewCard'
import type { Page } from './types'

const styles = `
  .reviews-page {
    max-width: 760px;
    margin: 0 auto;
  }

  .reviews-page h1 {
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    margin: 0 0 0.4rem 0;
    color: var(--text-primary);
  }

  .reviews-subtitle {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin: 0 0 1.5rem 0;
  }

  .reviews-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .reviews-room-select {
    min-height: 48px;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: var(--surface-card);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    max-width: 280px;
  }

  .reviews-room-select:focus-visible {
    outline: 2px solid var(--series-1);
    outline-offset: 2px;
  }

  .reviews-sort-toggle {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .reviews-sort-btn {
    min-height: 48px;
    padding: 0.5rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: transparent;
    color: var(--text-secondary);
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .reviews-sort-btn.active {
    background: var(--surface-card);
    color: var(--text-primary);
  }
  .reviews-sort-btn:not(.active):hover {
    color: var(--text-primary);
  }

  .reviews-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .reviews-avg {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .reviews-avg-stars {
    color: var(--series-4, #c98500);
    letter-spacing: 1px;
  }

  .reviews-tag-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 1rem;
  }

  .reviews-tag-pill {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--surface-card-2);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .reviews-write-btn {
    min-height: 48px;
    padding: 0.6rem 1.25rem;
    font-size: 0.9rem;
    font-weight: 600;
    background: var(--series-1);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .reviews-write-btn:hover { opacity: 0.88; }

  .reviews-list {
    margin-top: 0.5rem;
  }

  .reviews-empty {
    text-align: center;
    padding: 2.5rem 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .reviews-loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  /* ── Inline review form ── */
  .review-form {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem 1.35rem;
    margin-bottom: 1.5rem;
  }

  .review-form h2 {
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .review-form-field {
    margin-bottom: 1rem;
  }

  .review-form-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .review-form-stars {
    display: flex;
    gap: 0.25rem;
  }

  .review-form-star-btn {
    min-width: 48px;
    min-height: 48px;
    font-size: 1.6rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    line-height: 1;
    transition: color 0.1s;
  }
  .review-form-star-btn.filled {
    color: var(--series-4, #c98500);
  }

  .review-form-input {
    width: 100%;
    min-height: 48px;
    padding: 0.6rem 0.75rem;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--surface-0);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    box-sizing: border-box;
  }

  .review-form-input:focus-visible {
    outline: 2px solid var(--series-1);
    outline-offset: 2px;
  }

  .review-form-textarea {
    width: 100%;
    min-height: 100px;
    padding: 0.6rem 0.75rem;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--surface-0);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    resize: vertical;
    box-sizing: border-box;
  }

  .review-form-textarea:focus-visible {
    outline: 2px solid var(--series-1);
    outline-offset: 2px;
  }

  .review-form-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .review-form-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 48px;
    padding: 0.35rem 0.65rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    background: var(--surface-card-2);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .review-form-tag.selected {
    border-color: var(--series-1);
    color: var(--text-primary);
    background: color-mix(in srgb, var(--series-1) 12%, var(--surface-card-2));
  }

  .review-form-buttons {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .review-form-submit {
    min-height: 48px;
    padding: 0.6rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    background: var(--status-good, #0ca30c);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .review-form-cancel {
    min-height: 48px;
    padding: 0.6rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
`

function formatStars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

export const reviewsPage: Page = {
  mount(container: HTMLElement) {
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    const wrapper = document.createElement('div')
    wrapper.className = 'reviews-page'

    const heading = document.createElement('h1')
    heading.textContent = 'Room Reviews'
    wrapper.appendChild(heading)

    const subtitle = document.createElement('p')
    subtitle.className = 'reviews-subtitle'
    subtitle.textContent = 'Read and write reviews for study and meeting rooms.'
    wrapper.appendChild(subtitle)

    const content = document.createElement('div')
    content.className = 'reviews-content'
    wrapper.appendChild(content)

    container.appendChild(wrapper)

    let currentSort: 'recent' | 'helpful' = 'recent'
    let currentRoomId: string | null = null
    let destroyed = false

    // Controls row
    const controls = document.createElement('div')
    controls.className = 'reviews-controls'

    const roomSelect = document.createElement('select')
    roomSelect.className = 'reviews-room-select'
    roomSelect.setAttribute('aria-label', 'Select a room')
    controls.appendChild(roomSelect)

    const sortToggle = document.createElement('div')
    sortToggle.className = 'reviews-sort-toggle'

    const recentBtn = document.createElement('button')
    recentBtn.className = 'reviews-sort-btn active'
    recentBtn.textContent = 'Recent'
    recentBtn.setAttribute('data-sort', 'recent')
    sortToggle.appendChild(recentBtn)

    const helpfulBtn = document.createElement('button')
    helpfulBtn.className = 'reviews-sort-btn'
    helpfulBtn.textContent = 'Most Helpful'
    helpfulBtn.setAttribute('data-sort', 'helpful')
    sortToggle.appendChild(helpfulBtn)

    controls.appendChild(sortToggle)

    const writeBtn = document.createElement('button')
    writeBtn.className = 'reviews-write-btn'
    writeBtn.textContent = '✏️ Write a Review'
    controls.appendChild(writeBtn)

    content.appendChild(controls)

    // Summary + list container
    const summaryEl = document.createElement('div')
    summaryEl.className = 'reviews-summary-container'
    content.appendChild(summaryEl)

    const listEl = document.createElement('div')
    listEl.className = 'reviews-list'
    content.appendChild(listEl)

    // Load rooms and populate dropdown
    void (async () => {
      try {
        const rooms = await apiClient.getRooms()
        if (destroyed) return

        const placeholder = document.createElement('option')
        placeholder.value = ''
        placeholder.textContent = '— Select a room —'
        roomSelect.appendChild(placeholder)

        for (const room of rooms) {
          const opt = document.createElement('option')
          opt.value = room.roomId
          opt.textContent = `${room.name} (${room.building})`
          roomSelect.appendChild(opt)
        }

        // Default to first room that has reviews in mock data
        const reviewRooms = ['atlas-0.710', 'flux-2.240', 'neuron-0.150']
        const match = rooms.find((r) => reviewRooms.includes(r.roomId))
        if (match) {
          roomSelect.value = match.roomId
          currentRoomId = match.roomId
          void loadReviews()
        }
      } catch {
        // ignore — dropdown stays empty
      }
    })()

    roomSelect.addEventListener('change', () => {
      currentRoomId = roomSelect.value || null
      void loadReviews()
    })

    recentBtn.addEventListener('click', () => {
      currentSort = 'recent'
      recentBtn.classList.add('active')
      helpfulBtn.classList.remove('active')
      void loadReviews()
    })

    helpfulBtn.addEventListener('click', () => {
      currentSort = 'helpful'
      helpfulBtn.classList.add('active')
      recentBtn.classList.remove('active')
      void loadReviews()
    })

    writeBtn.addEventListener('click', () => {
      if (!currentRoomId) {
        roomSelect.focus()
        return
      }
      toggleReviewForm(writeBtn)
    })

    cleanup = () => { destroyed = true }

    async function loadReviews(): Promise<void> {
      if (!currentRoomId || destroyed) return

      summaryEl.innerHTML = ''
      listEl.innerHTML = ''

      const loading = document.createElement('div')
      loading.className = 'reviews-loading'
      loading.textContent = 'Loading reviews…'
      listEl.appendChild(loading)

      try {
        const reviews = await apiClient.getReviews(currentRoomId, currentSort)
        if (destroyed) return
        listEl.innerHTML = ''
        summaryEl.innerHTML = ''

        // Average rating
        if (reviews.length > 0) {
          const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
          const avgRow = document.createElement('div')
          avgRow.className = 'reviews-summary'
          const stars = document.createElement('span')
          stars.className = 'reviews-avg-stars'
          stars.textContent = formatStars(avg)
          avgRow.appendChild(stars)
          const label = document.createElement('span')
          label.className = 'reviews-avg'
          label.textContent = ` ${avg.toFixed(1)} / 5 (${reviews.length} review${reviews.length === 1 ? '' : 's'})`
          avgRow.appendChild(label)
          summaryEl.appendChild(avgRow)

          // Tag summary: most common tags
          const tagCounts = new Map<string, number>()
          for (const r of reviews) {
            for (const t of r.tags) {
              tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
            }
          }
          const topTags = [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)

          if (topTags.length > 0) {
            const tagRow = document.createElement('div')
            tagRow.className = 'reviews-tag-summary'
            for (const [tag, count] of topTags) {
              const pill = document.createElement('span')
              pill.className = 'reviews-tag-pill'
              pill.textContent = `${tag} (${count})`
              tagRow.appendChild(pill)
            }
            summaryEl.appendChild(tagRow)
          }
        }

        if (reviews.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'reviews-empty'
          empty.textContent = 'No reviews yet. Be the first to review this room!'
          listEl.appendChild(empty)
          return
        }

        for (const review of reviews) {
          listEl.appendChild(createReviewCard(review))
        }
      } catch {
        if (destroyed) return
        listEl.innerHTML = ''
        const err = document.createElement('div')
        err.className = 'reviews-empty'
        err.textContent = 'Unable to load reviews. Please try again later.'
        listEl.appendChild(err)
      }
    }

    function toggleReviewForm(triggerBtn: HTMLButtonElement): void {
      const existing = content.querySelector('.review-form')
      if (existing) {
        existing.remove()
        triggerBtn.textContent = '✏️ Write a Review'
        return
      }

      const form = createReviewForm(currentRoomId!, () => {
        form.remove()
        triggerBtn.textContent = '✏️ Write a Review'
        void loadReviews()
      })
      content.insertBefore(form, summaryEl)
      triggerBtn.textContent = 'Cancel'
    }

    function createReviewForm(
      roomId: string,
      onDone: () => void,
    ): HTMLElement {
      const form = document.createElement('div')
      form.className = 'review-form'

      const heading = document.createElement('h2')
      heading.textContent = 'Write a Review'
      form.appendChild(heading)

      // Star rating
      let selectedRating = 0
      const ratingField = document.createElement('div')
      ratingField.className = 'review-form-field'
      const ratingLabel = document.createElement('label')
      ratingLabel.className = 'review-form-label'
      ratingLabel.textContent = 'Rating'
      ratingField.appendChild(ratingLabel)

      const starRow = document.createElement('div')
      starRow.className = 'review-form-stars'
      const starBtns: HTMLButtonElement[] = []
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button')
        star.type = 'button'
        star.className = 'review-form-star-btn'
        star.textContent = '☆'
        star.setAttribute('data-rating', String(i))
        star.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`)
        star.addEventListener('click', () => {
          selectedRating = i
          updateStars()
        })
        starBtns.push(star)
        starRow.appendChild(star)
      }
      function updateStars(): void {
        for (let i = 0; i < 5; i++) {
          starBtns[i]!.textContent = i < selectedRating ? '★' : '☆'
          starBtns[i]!.classList.toggle('filled', i < selectedRating)
        }
      }
      ratingField.appendChild(starRow)
      form.appendChild(ratingField)

      // Title
      const titleField = document.createElement('div')
      titleField.className = 'review-form-field'
      const titleLabel = document.createElement('label')
      titleLabel.className = 'review-form-label'
      titleLabel.textContent = 'Title (3–50 characters)'
      titleField.appendChild(titleLabel)
      const titleInput = document.createElement('input')
      titleInput.className = 'review-form-input'
      titleInput.type = 'text'
      titleInput.maxLength = 50
      titleInput.setAttribute('placeholder', 'Summary of your experience')
      titleField.appendChild(titleInput)
      form.appendChild(titleField)

      // Body
      const bodyField = document.createElement('div')
      bodyField.className = 'review-form-field'
      const bodyLabel = document.createElement('label')
      bodyLabel.className = 'review-form-label'
      bodyLabel.textContent = 'Review (10–500 characters)'
      bodyField.appendChild(bodyLabel)
      const bodyInput = document.createElement('textarea')
      bodyInput.className = 'review-form-textarea'
      bodyInput.maxLength = 500
      bodyInput.setAttribute('placeholder', 'Share details about the room…')
      bodyField.appendChild(bodyInput)
      form.appendChild(bodyField)

      // Tags
      const tagsField = document.createElement('div')
      tagsField.className = 'review-form-field'
      const tagsLabel = document.createElement('label')
      tagsLabel.className = 'review-form-label'
      tagsLabel.textContent = 'Tags'
      tagsField.appendChild(tagsLabel)
      const tagContainer = document.createElement('div')
      tagContainer.className = 'review-form-tags'
      const selectedTags = new Set<string>()
      for (const tag of REVIEW_TAGS) {
        const tagBtn = document.createElement('button')
        tagBtn.type = 'button'
        tagBtn.className = 'review-form-tag'
        tagBtn.textContent = tag
        tagBtn.setAttribute('data-tag', tag)
        tagBtn.addEventListener('click', () => {
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag)
            tagBtn.classList.remove('selected')
          } else {
            selectedTags.add(tag)
            tagBtn.classList.add('selected')
          }
        })
        tagContainer.appendChild(tagBtn)
      }
      tagsField.appendChild(tagContainer)
      form.appendChild(tagsField)

      // Author name
      const authorField = document.createElement('div')
      authorField.className = 'review-form-field'
      const authorLabel = document.createElement('label')
      authorLabel.className = 'review-form-label'
      authorLabel.textContent = 'Your name'
      authorField.appendChild(authorLabel)
      const authorInput = document.createElement('input')
      authorInput.className = 'review-form-input'
      authorInput.type = 'text'
      authorInput.value = 'anonymous'
      authorField.appendChild(authorInput)
      form.appendChild(authorField)

      // Buttons
      const buttonRow = document.createElement('div')
      buttonRow.className = 'review-form-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.className = 'review-form-cancel'
      cancelBtn.textContent = 'Cancel'
      cancelBtn.addEventListener('click', onDone)
      buttonRow.appendChild(cancelBtn)

      const submitBtn = document.createElement('button')
      submitBtn.type = 'button'
      submitBtn.className = 'review-form-submit'
      submitBtn.textContent = 'Submit Review'
      submitBtn.addEventListener('click', async () => {
        // Validation
        if (selectedRating === 0) {
          submitBtn.textContent = 'Please select a rating'
          setTimeout(() => { submitBtn.textContent = 'Submit Review' }, 2000)
          return
        }
        if (titleInput.value.trim().length < 3) {
          submitBtn.textContent = 'Title too short (min 3)'
          setTimeout(() => { submitBtn.textContent = 'Submit Review' }, 2000)
          return
        }
        if (bodyInput.value.trim().length < 10) {
          submitBtn.textContent = 'Review too short (min 10)'
          setTimeout(() => { submitBtn.textContent = 'Submit Review' }, 2000)
          return
        }

        submitBtn.disabled = true
        submitBtn.textContent = 'Submitting…'
        try {
          await apiClient.createReview({
            roomId,
            authorId: 'user-1',
            authorName: authorInput.value.trim() || 'anonymous',
            rating: selectedRating,
            title: titleInput.value.trim(),
            body: bodyInput.value.trim(),
            tags: [...selectedTags],
          })
          onDone()
        } catch {
          submitBtn.disabled = false
          submitBtn.textContent = 'Failed — try again'
          setTimeout(() => { submitBtn.textContent = 'Submit Review' }, 2000)
        }
      })
      buttonRow.appendChild(submitBtn)

      form.appendChild(buttonRow)
      return form
    }
  },

  unmount() {
    if (cleanup) cleanup()
  },
}

// RoomReview type re-exported for potential consumers
export type { RoomReview }

let cleanup: (() => void) | null = null
