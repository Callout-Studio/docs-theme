// Turns one folder of the Callout Studio docs into Quartz content.
//
// The docs are written to be read on GitHub: pages link to each other and to
// source files with relative paths, and each page's title is its first "# "
// heading. Quartz wants the title in front matter, the folder's README as
// index.md, every link that leaves the folder pointed at a real address, and
// GitHub's alerts (> [!NOTE]) as callouts. The text itself is copied as
// written, with three additions for the site:
// - an alert whose first paragraph is only bold text, like **In short**, takes
//   that text as its title (GitHub shows it as the alert's first line); a bold
//   lead-in that runs on into its paragraph stays text;
// - a code fence marked `preview` (```md preview) is followed by what its
//   callouts look like in a note, since the site can draw them;
// - the closing "**Next:** …" or "Next chapter: …" line goes, since the chapter
//   list beside the page already gives that link;
// - a page that was renamed keeps its old address as a redirect: site.json's
//   `redirects` maps each old file name to the new one.
//
// Usage: node prepare-content.mjs <site.json> <Callout Studio checkout> <content folder>
//
// The checkout may be sparse and blob-less: everything except the pages comes
// from the commit's trees and history, so no other file is downloaded.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const posix = path.posix;

const [configFile, sourceDir, contentDir] = process.argv.slice(2);
if (!configFile || !sourceDir || !contentDir) {
	console.error("Usage: node prepare-content.mjs <site.json> <Callout Studio checkout> <content folder>");
	process.exit(2);
}

/**
 * repository: owner/name on GitHub, for links to files outside the sites.
 * folder: the docs folder this site publishes.
 * copy: folders copied beside the pages as they are (pictures).
 * sites: every docs folder that has a site, and the site's address.
 * redirects: old page name → new page name, for pages that were renamed.
 */
const site = JSON.parse(readFileSync(configFile, "utf8"));
const copyFolders = site.copy ?? [];
const oldNamesOf = new Map();
for (const [oldName, newName] of Object.entries(site.redirects ?? {})) {
	oldNamesOf.set(newName, [...(oldNamesOf.get(newName) ?? []), oldName]);
}

const git = (...args) =>
	execFileSync("git", ["-C", sourceDir, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const commit = git("rev-parse", "HEAD").trim();
const repoUrl = `https://github.com/${site.repository}`;

// Every path in the commit, so a link can be checked against the real tree.
const lines = (text) => text.split("\n").filter(Boolean);
const files = new Set(lines(git("ls-tree", "-r", "--name-only", commit)));
const dirs = new Set(lines(git("ls-tree", "-r", "-d", "--name-only", commit)));

// When each page last changed, from one walk over the folder's history.
// --no-renames keeps git from reading file contents to detect renames.
const lastChanged = new Map();
let commitDate = "";
for (const line of git("log", "--no-renames", "--format=@%cI", "--name-only", commit, "--", site.folder).split("\n")) {
	if (line.startsWith("@")) commitDate = line.slice(1);
	else if (line && !lastChanged.has(line)) lastChanged.set(line, commitDate);
}

const inside = (repoPath, folder) => repoPath === folder || repoPath.startsWith(folder + "/");

/** Where a page, or a copied file, lands inside the content folder. */
function contentPathOf(repoPath) {
	if (inside(repoPath, site.folder)) {
		return posix.relative(site.folder, repoPath).replace(/(^|\/)README\.md$/, "$1index.md");
	}
	return repoPath;
}

const warnings = [];
const counts = { pages: 0, copied: 0, local: 0, otherSite: 0, github: 0 };

/** The address a link should have on the site. */
function rewriteTarget(target, pageRepoPath) {
	// Web addresses, mail links and links inside the same page stay as they are.
	if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("/")) return target;

	const hashAt = target.indexOf("#");
	const pathPart = hashAt === -1 ? target : target.slice(0, hashAt);
	const hash = hashAt === -1 ? "" : target.slice(hashAt);
	let decoded = pathPart;
	try {
		decoded = decodeURI(pathPart);
	} catch {
		// Not percent-encoded after all: use it as written.
	}
	const repoPath = posix.normalize(posix.join(posix.dirname(pageRepoPath), decoded)).replace(/\/+$/, "");
	if (repoPath === ".." || repoPath.startsWith("../")) {
		warnings.push(`${pageRepoPath}: "${target}" points outside the repository`);
		return target;
	}
	if (!files.has(repoPath) && !dirs.has(repoPath)) {
		warnings.push(`${pageRepoPath}: "${target}" points at ${repoPath}, which is not in ${commit.slice(0, 7)}`);
	}

	// A page of this site, or a picture copied beside the pages.
	if (inside(repoPath, site.folder) || copyFolders.some((folder) => inside(repoPath, folder))) {
		counts.local++;
		let relative = posix.relative(posix.dirname(contentPathOf(pageRepoPath)), contentPathOf(repoPath));
		if (!relative.startsWith(".")) relative = "./" + relative;
		return encodeURI(relative) + hash;
	}

	// A page of the other docs site.
	for (const [folder, address] of Object.entries(site.sites)) {
		if (folder === site.folder || !inside(repoPath, folder)) continue;
		counts.otherSite++;
		const slug = posix.relative(folder, repoPath).replace(/\.md$/, "").replace(/(^|\/)README$/, "$1");
		return `${address.replace(/\/+$/, "")}/${encodeURI(slug)}${hash}`;
	}

	// Anything else in the repository: the file on GitHub, at the commit these
	// docs were built from, so the link always shows what the page described.
	counts.github++;
	const kind = dirs.has(repoPath) ? "tree" : "blob";
	return `${repoUrl}/${kind}/${commit}/${encodeURI(repoPath)}${hash}`;
}

/**
 * The line with every `code span` (backticks included) blanked out, same length.
 * A link whose text is code, like [`src/main.ts`](../../src/main.ts), still
 * matches; a link written inside code does not.
 */
function maskCodeSpans(line) {
	let masked = "";
	let at = 0;
	while (at < line.length) {
		const tick = line.indexOf("`", at);
		if (tick === -1) {
			masked += line.slice(at);
			break;
		}
		masked += line.slice(at, tick);
		let runEnd = tick;
		while (line[runEnd] === "`") runEnd++;
		const run = runEnd - tick;
		// The span closes at the next run of exactly as many backticks.
		let close = -1;
		for (let search = runEnd; search < line.length; ) {
			const next = line.indexOf("`", search);
			if (next === -1) break;
			let end = next;
			while (line[end] === "`") end++;
			if (end - next === run) {
				close = end;
				break;
			}
			search = end;
		}
		if (close === -1) {
			masked += line.slice(tick, runEnd);
			at = runEnd;
		} else {
			masked += "x".repeat(close - tick);
			at = close;
		}
	}
	return masked;
}

// [text](target "title") and ![alt](target), allowing one level of brackets in the text.
const LINK = /(!?\[(?:[^[\]\\]|\\.|\[[^\]]*\])*\]\(\s*)(<[^>]*>|[^)\s]+)((?:\s+"[^"]*")?\s*\))/dg;

function rewriteLinks(line, pageRepoPath) {
	const masked = maskCodeSpans(line);
	const edits = [];
	for (const match of masked.matchAll(LINK)) {
		const [start, end] = match.indices[2];
		const target = line.slice(start, end);
		// The target itself sits in a code span: not a link.
		if (target !== masked.slice(start, end)) continue;
		const bracketed = target.startsWith("<") && target.endsWith(">");
		const rewritten = rewriteTarget(bracketed ? target.slice(1, -1) : target, pageRepoPath);
		edits.push([start, end, bracketed ? `<${rewritten}>` : rewritten]);
	}
	let out = line;
	for (const [start, end, text] of edits.reverse()) out = out.slice(0, start) + text + out.slice(end);
	return out;
}

// A fence may sit inside a quote or a list item, so any prefix of spaces and ">".
const FENCE = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})(.*)$/;

// GitHub's alerts (> [!NOTE] and so on) as Quartz callouts that look the same:
// GitHub titles them "Note", not "NOTE", and draws CAUTION in red.
const GITHUB_ALERT = /^((?:[ \t]*>)+[ \t]*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/;
const ALERT_AS_CALLOUT = {
	NOTE: ["note", "Note"],
	TIP: ["tip", "Tip"],
	IMPORTANT: ["important", "Important"],
	WARNING: ["warning", "Warning"],
	CAUTION: ["danger", "Caution"],
};
// The alert's own title, when its first line is only bold text.
const BOLD_LINE = /^((?:[ \t]*>)+[ \t]*)\*\*([^*]+)\*\*[ \t]*$/;
const EMPTY_QUOTE_LINE = /^(?:[ \t]*>)+[ \t]*$/;

const escapeHtml = (value) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A callout token: [!id], [!id|metadata], and for inline callouts {text} after it.
const TOKEN = /\[!([^\]|\s]+)((?:\|[^\]]*)?)\](?:\{([^}]*)\})?/g;
const HEADING_CALLOUT = /^(#{1,6})[ \t]+\[!([^\]|\s]+)((?:\|[^\]]*)?)\][ \t]*(.*)$/;

/** "mark" → "Mark", the way Obsidian titles a callout without its own title. */
const titleOf = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const metadataAttribute = (pipe) => {
	const words = pipe.replace(/^\|/, "").split(/[|\s]+/).filter(Boolean).join(" ");
	return words ? ` data-callout-metadata="${escapeHtml(words)}"` : "";
};
const calloutParts = (id, pipe, title) =>
	`data-callout="${escapeHtml(id.toLowerCase())}"${metadataAttribute(pipe)}>` +
	`<span class="callout-icon" aria-hidden="true"></span>` +
	`<span class="callout-title-inner">${escapeHtml(title)}</span>`;

/** A line of text with its inline callouts drawn as pills and its `code` kept. */
function inlinePreview(line) {
	let html = "";
	let at = 0;
	const plain = (value) => escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
	for (const match of line.matchAll(TOKEN)) {
		html += plain(line.slice(at, match.index));
		const [, id, pipe, text] = match;
		html += `<span class="callout cs-inline-callout" ${calloutParts(id, pipe, text ?? titleOf(id))}</span>`;
		at = match.index + match[0].length;
	}
	return html + plain(line.slice(at));
}

/**
 * What a ```md preview fence looks like in a note. Block callouts stay
 * Markdown, which Quartz draws as callouts; heading and inline callouts, which
 * only Callout Studio draws, become the HTML it would make. A heading callout
 * is not made a real heading here, so it stays out of the table of contents.
 */
function renderPreview(body) {
	const out = ["", '<div class="cs-preview" role="group" aria-label="How this looks in a note">', ""];
	let quote = [];
	let paragraph = [];
	const flushQuote = () => {
		if (quote.length) out.push(...quote, "");
		quote = [];
	};
	const flushParagraph = () => {
		if (paragraph.length) out.push(`<p>${paragraph.map(inlinePreview).join(" ")}</p>`, "");
		paragraph = [];
	};
	for (const line of body) {
		if (/^[ \t]*>/.test(line)) {
			flushParagraph();
			quote.push(line);
			continue;
		}
		flushQuote();
		const heading = HEADING_CALLOUT.exec(line);
		if (heading) {
			flushParagraph();
			const [, marks, id, pipe, title] = heading;
			out.push(
				`<div class="callout cs-heading-callout cs-heading-${marks.length}" ${calloutParts(id, pipe, title || titleOf(id))}</div>`,
				"",
			);
		} else if (line.trim() === "") {
			flushParagraph();
		} else {
			paragraph.push(line);
		}
	}
	flushParagraph();
	flushQuote();
	out.push("</div>", "");
	return out;
}

function convertPage(text, pageRepoPath) {
	const lines = text.split(/\r?\n/);
	// The closing "---" and "**Next:** [...](...)" (or "Next chapter: [...](...)")
	// lines: the chapter list beside the page has the link.
	let end = lines.length;
	while (end > 0 && lines[end - 1].trim() === "") end--;
	const NEXT_LINE = /^(?:\*\*Next:\*\*|Next chapter:)\s+\[.*\]\(.*\)\s*$/;
	if (end >= 2 && NEXT_LINE.test(lines[end - 1]) && lines[end - 2].trim() === "---") {
		end -= 2;
	}

	const out = [];
	let fence = null;
	let title = null;
	let dropBlankAfterTitle = false;
	for (let i = 0; i < end; i++) {
		const line = lines[i];
		const match = FENCE.exec(line);
		if (fence) {
			if (match && match[2][0] === fence.char && match[2].length >= fence.length && match[3].trim() === "") {
				out.push(line);
				if (fence.preview) out.push(...renderPreview(fence.body));
				fence = null;
				continue;
			}
			fence.body.push(line);
			out.push(line);
			continue;
		}
		if (match && !(match[2][0] === "`" && match[3].includes("`"))) {
			// Only a fence that is not inside a quote or a list can have a preview.
			const preview = match[1] === "" && /(^|\s)preview(\s|$)/.test(match[3]);
			fence = { char: match[2][0], length: match[2].length, preview, body: [] };
			out.push(line);
			continue;
		}
		if (title === null) {
			const heading = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
			if (heading) {
				title = heading[1];
				dropBlankAfterTitle = true;
				continue;
			}
		}
		if (dropBlankAfterTitle) {
			dropBlankAfterTitle = false;
			if (line.trim() === "") continue;
		}
		const alert = GITHUB_ALERT.exec(line);
		if (alert) {
			let [type, name] = ALERT_AS_CALLOUT[alert[2]];
			const bold = BOLD_LINE.exec(lines[i + 1] ?? "");
			const sameQuote = bold && bold[1].replace(/\s/g, "") === alert[1].replace(/\s/g, "");
			if (sameQuote && EMPTY_QUOTE_LINE.test(lines[i + 2] ?? "")) {
				name = bold[2].trim();
				i += 2;
			}
			out.push(`${alert[1]}[!${type}] ${name}`);
			continue;
		}
		out.push(rewriteLinks(line, pageRepoPath));
	}

	// The title as plain text: no code marks, emphasis or link syntax.
	const plainTitle = (title ?? posix.basename(pageRepoPath, ".md"))
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[`*_]/g, "")
		.trim();
	const frontMatter = [`title: ${JSON.stringify(plainTitle)}`, `sourcePath: ${JSON.stringify(pageRepoPath)}`];
	const modified = lastChanged.get(pageRepoPath);
	if (modified) frontMatter.push(`modified: ${modified}`);
	const oldNames = oldNamesOf.get(posix.basename(pageRepoPath, ".md"));
	if (oldNames) frontMatter.push(`aliases: ${JSON.stringify(oldNames)}`);
	return `---\n${frontMatter.join("\n")}\n---\n\n${out.join("\n")}`;
}

/** Every file under a folder of the checkout, as repository paths. */
function walk(folder) {
	const found = [];
	for (const entry of readdirSync(path.join(sourceDir, folder), { withFileTypes: true })) {
		const repoPath = posix.join(folder, entry.name);
		if (entry.isDirectory()) found.push(...walk(repoPath));
		else found.push(repoPath);
	}
	return found;
}

rmSync(contentDir, { recursive: true, force: true });
mkdirSync(contentDir, { recursive: true });

for (const repoPath of walk(site.folder)) {
	const target = path.join(contentDir, contentPathOf(repoPath));
	mkdirSync(path.dirname(target), { recursive: true });
	if (repoPath.endsWith(".md")) {
		writeFileSync(target, convertPage(readFileSync(path.join(sourceDir, repoPath), "utf8"), repoPath));
		counts.pages++;
	} else {
		cpSync(path.join(sourceDir, repoPath), target);
		counts.copied++;
	}
}

for (const folder of copyFolders) {
	for (const repoPath of walk(folder)) {
		// A Markdown file here would become a page of the site.
		if (repoPath.endsWith(".md") || !statSync(path.join(sourceDir, repoPath)).isFile()) continue;
		const target = path.join(contentDir, repoPath);
		mkdirSync(path.dirname(target), { recursive: true });
		cpSync(path.join(sourceDir, repoPath), target);
		counts.copied++;
	}
}

console.log(
	`${site.folder} at ${commit.slice(0, 7)}: ${counts.pages} pages, ${counts.copied} other files; ` +
		`links: ${counts.local} inside the site, ${counts.otherSite} to the other site, ${counts.github} to GitHub`,
);
for (const warning of warnings) {
	// GitHub Actions shows these as warnings on the run, without failing it.
	console.log(process.env.GITHUB_ACTIONS ? `::warning::${warning}` : `warning: ${warning}`);
}
