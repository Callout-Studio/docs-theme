// The links that belong to the page rather than to the site. prepare-content.mjs
// writes the page's source path into it as `sourcePath`.
//
// theme/site.ts places the component twice, and the stylesheet shows the one that
// fits:
//   - `rail`, in the right-hand column under the table of contents and the
//     graph, which stays in view while reading: groups of links, each under a
//     small heading, with a line between the groups. Help, then the page itself
//     (edit it, see its history), then `extra`, the group each site chooses.
//   - `end`, under the article, for the widths where that column is hidden: only
//     the two links most worth keeping, where to ask and where to edit.

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"

// Lucide icons (ISC License).
const ICON = {
  question:
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  lightbulb:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  pullRequest:
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
}
type IconName = keyof typeof ICON

const Icon = ({ name }: { name: IconName }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[name] }} />
)

interface Link {
  text: string
  href: string
  icon: IconName
}

interface Group {
  title: string
  links: Link[]
}

interface Options {
  /** owner/name on GitHub */
  repository: string
  branch: string
  place: "rail" | "end"
  /** The last group of the rail, which each site chooses. */
  extra?: Group
}

const Links = ({ links }: { links: Link[] }) => (
  <>
    {links.map((link) => (
      <a href={link.href}>
        <Icon name={link.icon} />
        {link.text}
      </a>
    ))}
  </>
)

export default ((opts: Options) => {
  const PageActions: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
    const sourcePath = fileData.frontmatter?.sourcePath as string | undefined
    if (!sourcePath) return null
    const repo = `https://github.com/${opts.repository}`
    const title = String(fileData.frontmatter?.title ?? "")
    const file = encodeURI(sourcePath)

    // The question form opens with the title and the question's text already
    // started: where it was asked, as a link to this page and to its file.
    // GitHub fills a form's field from the query parameter that has the
    // field's id, and `question` is the id of the form's text box.
    const slug = String(fileData.slug ?? "")
    const address = cfg.baseUrl ? `https://${cfg.baseUrl}/${slug === "index" ? "" : slug}` : undefined
    const context = [
      address ? `**Page:** [${title}](${address})` : `**Page:** ${title}`,
      `**Source:** \`${sourcePath}\``,
      "",
      "**My question:**",
      "",
    ].join("\n")
    const ask: Link = {
      text: "Ask a question",
      href:
        `${repo}/issues/new?template=question.yml` +
        `&title=${encodeURIComponent(`[Question]: ${title} - `)}` +
        `&question=${encodeURIComponent(context)}`,
      icon: "question",
    }
    const edit: Link = { text: "Edit this page", href: `${repo}/blob/${opts.branch}/${file}`, icon: "pencil" }

    if (opts.place === "end") {
      return (
        <aside class="cs-page-actions cs-page-actions-end" aria-label="About this page">
          <Links links={[ask, edit]} />
        </aside>
      )
    }

    const groups: Group[] = [
      {
        title: "Help",
        links: [
          ask,
          { text: "Report a bug", href: `${repo}/issues/new?template=bug_report.yml`, icon: "bug" },
          { text: "Suggest an idea", href: `${repo}/issues/new?template=feature_request.yml`, icon: "lightbulb" },
        ],
      },
      {
        title: "This page",
        links: [edit, { text: "Page history", href: `${repo}/commits/${opts.branch}/${file}`, icon: "history" }],
      },
    ]
    if (opts.extra) groups.push(opts.extra)

    return (
      <aside class="cs-page-actions cs-page-actions-rail" aria-label="About this page">
        {groups.map((group) => (
          <section class="cs-rail-group">
            <h3>{group.title}</h3>
            <Links links={group.links} />
          </section>
        ))}
      </aside>
    )
  }
  return PageActions
}) satisfies QuartzComponentConstructor<Options>
