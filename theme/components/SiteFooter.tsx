// The bottom of every page, one row across the whole page (both sidebars and
// the article between them): on the left the plugin's name with the year and
// its license, on the right the site's links (plain words) and the light and
// dark switch (an icon only).
//
// On a phone it is still one row, so what does not fit is left out: the
// license and every link marked `hideOnPhone` (class `cs-footer-extra`, hidden
// by the stylesheet below 640px). The name, the links that stay and the switch
// are the ones that fit at the narrowest widths. A link marked `hideOnSmallPhone`
// (class `cs-footer-extra-xs`) goes too below 345px, where even those do not fit.
//
// The switch is drawn here, but what it does is Quartz's: the darkmode
// component's script (theme/site.ts hands the component over) finds every element
// with the class `darkmode`, flips the page's `saved-theme` and remembers the
// choice. The icon shows what a click does: a moon on a light page ("Dark
// mode"), a sun on a dark one ("Light mode"). The stylesheet shows one of the
// two (`cs-to-dark`, `cs-to-light`); each keeps its words, hidden from the eye
// but read out by a screen reader, and as the tooltip.

import type { QuartzComponent, QuartzComponentConstructor } from "../../quartz/components/types"

interface Options {
  /** On the left: "© 2026 <name>". */
  name: string
  year: number
  /** The license the plugin is released under, shown after the name. */
  license?: { text: string; href: string }
  /**
   * `hideOnPhone`: left out on a phone (below 640px), to keep the footer to one
   * row. `hideOnSmallPhone`: left out below 345px as well.
   */
  links: { text: string; href: string; hideOnPhone?: boolean; hideOnSmallPhone?: boolean }[]
  /** Quartz's darkmode component: its script and styles do the switching. */
  toggle?: QuartzComponent
}

export default ((opts: Options) => {
  const Toggle = opts.toggle
  const SiteFooter: QuartzComponent = () => (
    <footer class="cs-footer">
      <p class="cs-footer-name">
        © {opts.year} {opts.name}
        {opts.license && (
          <>
            <span class="cs-footer-extra" aria-hidden="true"> · </span>
            <a class="cs-footer-extra" href={opts.license.href}>{opts.license.text}</a>
          </>
        )}
      </p>
      <ul>
        {opts.links.map((link) => (
          <li class={link.hideOnPhone ? "cs-footer-extra" : link.hideOnSmallPhone ? "cs-footer-extra-xs" : undefined}>
            <a href={link.href}>
              {link.text}
            </a>
          </li>
        ))}
        {Toggle && (
          <li>
            <button type="button" class="darkmode cs-theme">
              <span class="cs-to-dark" title="Dark mode">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                <span class="cs-sr">Dark mode</span>
              </span>
              <span class="cs-to-light" title="Light mode">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                <span class="cs-sr">Light mode</span>
              </span>
            </button>
          </li>
        )}
      </ul>
    </footer>
  )
  // The switch's script and styles come with the component.
  SiteFooter.css = Toggle?.css
  SiteFooter.beforeDOMLoaded = Toggle?.beforeDOMLoaded
  SiteFooter.afterDOMLoaded = Toggle?.afterDOMLoaded
  return SiteFooter
}) satisfies QuartzComponentConstructor<Options>
