// The top of the home page: the tagline, the two buttons, and a picture in an
// Obsidian window (the user guide's shows the three callout forms, the
// internal docs' the plugin's core loop). Other pages render nothing.
//
// The picture is an SVG written into the page itself rather than loaded as a
// file: it is the largest thing on the first screen, and a separate request
// would delay the moment the page looks ready.

import { readFileSync } from "node:fs"
import path from "node:path"
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"
import type { FullSlug } from "../../quartz/util/path"

// Both pictures draw their window from y=24 to y=457 of a 519-high view. The
// page shows only the top 438 of it, so the panel's lower edge cuts the window
// off above its own bottom edge and rounded corners: it looks like it carries
// on below the panel.
const PICTURE_HEIGHT = 438

/** The SVG with its ids prefixed, so they cannot clash with the page's own. */
function inlineSvg(file: string, prefix: string): string {
  let svg = readFileSync(path.join("quartz", "static", file), "utf8").replace(/^<\?xml[^>]*>\s*/, "")
  // Crop the view; without width and height the box takes the view's ratio.
  svg = svg.replace(/^<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\s(?:width|height)="[^"]*"/g, "")
      .replace(/viewBox="0 0 (\S+) \S+"/, (_, width) => `viewBox="0 0 ${width} ${PICTURE_HEIGHT}"`),
  )
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    svg = svg
      .replace(new RegExp(`\\sid="${escaped}"`, "g"), ` id="${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${escaped}"`, "g"), `href="#${prefix}${id}"`)
      .replace(new RegExp(`(aria-labelledby="[^"]*)\\b${escaped}\\b`, "g"), `$1${prefix}${id}`)
  }
  // Quartz's base styles color every <text> on the page (fill: var(--darkgray)),
  // which beats a fill attribute; an inline style keeps the picture's own.
  svg = svg.replace(/<text\b[^>]*>/g, (tag) => {
    const fill = /\sfill="([^"]+)"/.exec(tag)?.[1]
    if (!fill) return tag
    return /\sstyle="/.test(tag)
      ? tag.replace(/\sstyle="/, ` style="fill:${fill};`)
      : tag.replace(/>$/, ` style="fill:${fill}">`)
  })
  return svg.replace("<svg ", '<svg class="cs-hero-art" ')
}

// Lucide icons (ISC License).
// The brush on its own: the plugin's logo without its tile.
const BRUSH =
  '<path d="m14.622 17.897-10.68-2.913"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/>'

const ICON = {
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
}

interface Options {
  eyebrow: string
  /** The heading, and the words at its end drawn in the accent colour. */
  title: string
  titleAccent: string
  lead: string
  primary: { text: string; href: string }
  secondary: { text: string; href: string; icon: keyof typeof ICON }
  /** An SVG in the site's theme/static/, which names itself (<title> and <desc>). */
  image: string
}

export default ((opts: Options) => {
  let art: string | undefined
  const HomeHero: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const slug = fileData.slug as FullSlug
    if (slug !== "index") return null
    art ??= inlineSvg(opts.image, "cs-hero-art-")
    return (
      <section class="cs-hero" aria-labelledby="cs-hero-title">
        <div class="cs-hero-text">
          <p class="cs-hero-eyebrow">
            <svg class="cs-hero-brush" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BRUSH }} />
            {opts.eyebrow}
          </p>
          <h1 id="cs-hero-title">
            {opts.title} <span class="cs-hero-accent">{opts.titleAccent}</span>
          </h1>
          <p class="cs-hero-lead">{opts.lead}</p>
          <div class="cs-hero-actions">
            <a class="cs-button cs-button-primary" href={opts.primary.href}>
              {opts.primary.text}
            </a>
            <a class="cs-button" href={opts.secondary.href}>
              <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[opts.secondary.icon] }} />
              {opts.secondary.text}
            </a>
          </div>
        </div>
        <div class="cs-hero-picture" dangerouslySetInnerHTML={{ __html: art }} />
      </section>
    )
  }
  return HomeHero
}) satisfies QuartzComponentConstructor<Options>
