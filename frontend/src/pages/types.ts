/** A page module rendered into the router's #app container. */
export interface Page {
  mount(container: HTMLElement): void | Promise<void>
  /** Called before the next page mounts — stop timers/observers here. */
  unmount?(): void
}
