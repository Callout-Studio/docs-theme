// The picture a link to the site shows when shared (1200 × 630): the logo, the
// page's title and description, and the three callout forms, on the README
// banner's dark purple. A site can give its home page its own words (the user
// guide shows the tagline there).
// Drawn by Satori, which supports flexbox layouts only.

import { readFileSync } from "node:fs"
import path from "node:path"

const INK = "#f5f2ff"
const MUTED = "#cbb9e7"

const icon = (body: string, color: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  ).toString("base64")}`

const BULB = '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'
const FLAG = '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'
const STAR = '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'

let logo: string | undefined
function logoDataUri(): string {
  if (!logo) {
    const svg = readFileSync(path.join("quartz", "static", "logo.svg"))
    logo = `data:image/svg+xml;base64,${svg.toString("base64")}`
  }
  return logo
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`

function Chip({ rgb, iconBody, text, wide }: { rgb: string; iconBody: string; text: string; wide?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: wide ? "14px 22px" : "8px 18px",
        borderRadius: wide ? 10 : 999,
        backgroundColor: `rgba(${rgb}, 0.18)`,
        color: `rgb(${rgb})`,
        fontSize: wide ? 28 : 24,
        fontWeight: 600,
      }}
    >
      <img src={icon(iconBody, `rgb(${rgb})`)} width={wide ? 28 : 24} height={wide ? 28 : 24} />
      {text}
    </div>
  )
}

interface ImageProps {
  cfg: { pageTitle?: string; pageTitleSuffix?: string }
  title: string
  description: string
  fileData: { slug?: string }
}

export const ogImage = (home?: { heading: string; text: string }) => ({ cfg, title, description, fileData }: ImageProps) => {
  const atHome = home && fileData.slug === "index"
  const suffix = cfg.pageTitleSuffix ?? ""
  const pageTitle = suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
  const heading = atHome ? home.heading : pageTitle
  const text = atHome ? home.text : clip(description, 150)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "60px 72px",
        backgroundColor: "#14101e",
        backgroundImage:
          "radial-gradient(circle at 78% 18%, rgba(107, 71, 194, 0.55), rgba(20, 16, 30, 0) 52%), linear-gradient(135deg, #1c142b 0%, #14101e 70%)",
        fontFamily: "Inter",
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={logoDataUri()} width={68} height={68} />
        <div style={{ fontSize: 30, fontWeight: 600, color: MUTED }}>{cfg.pageTitle ?? ""}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: "auto" }}>
        <div
          style={{
            fontSize: heading.length > 34 ? 60 : 72,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.06,
          }}
        >
          {heading}
        </div>
        {text && <div style={{ fontSize: 29, lineHeight: 1.4, color: MUTED, maxWidth: 1000 }}>{text}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 44 }}>
        <Chip rgb="180, 156, 255" iconBody={BULB} text="Heading callout" wide />
        <Chip rgb="79, 209, 197" iconBody={FLAG} text="Inline" />
        <Chip rgb="245, 166, 90" iconBody={STAR} text="Block callout" wide />
      </div>
    </div>
  )
}
