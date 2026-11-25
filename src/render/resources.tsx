/** @jsx h */
/** @jsxFrag Fragment */
import { renderCode } from "../markdown/code-blocks.ts";
import { formatSize, resourceIcon, type Resource } from "../site/resources.ts";
import { resourceUrl, type Page, type Site } from "../site/site.ts";
import { Fragment, h, Icon, raw } from "./jsx.ts";

/**
 * Renders a resource action: a link with an icon, downloading the file when
 * `download` is set.
 */
function Action(props: { url: string; icon: string; label: string; download?: boolean }) {
  return (
    <a class="resource-action" href={props.url} download={props.download}>
      <Icon name={props.icon} />
      {props.label}
    </a>
  );
}

/**
 * Renders the file browser of a folder or skill resource: one row per file,
 * code files opening into a highlighted preview with a copy button, every file
 * with its own download link.
 */
function FileBrowser(props: { site: Site; resource: Resource }) {
  const files = props.resource.files!;
  return (
    <details class="resource-files">
      <summary>
        <Icon name="chevron-right" />
        Browse {files.length} file{files.length === 1 ? "" : "s"}
      </summary>
      <ul>
        {files.map((file) => {
          const url = resourceUrl(props.site.config, file.path);
          const head = (
            <>
              <Icon name={resourceIcon(file)} />
              <span>{file.title}</span>
              <small>{formatSize(file.size)}</small>
            </>
          );
          return (
            <li>
              {file.code === undefined ? (
                <a class="resource-file" href={url} download>
                  {head}
                </a>
              ) : (
                <details>
                  <summary class="resource-file">{head}</summary>
                  {raw(renderCode(file.code, file.extension, file.title))}
                  <Action url={url} icon="download" label="Download" download />
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const kindLabels: Record<Resource["kind"], string> = {
  skill: "AI skill",
  folder: "Folder",
  code: "Code",
  document: "Document",
  file: "File",
};

/**
 * Renders one resource card: icon, title and size, description, actions, and
 * a code preview or a file browser. A folder offers its archive; a skill also
 * links its SKILL.md and copies an install command.
 */
function ResourceCard(props: { site: Site; resource: Resource }) {
  const { site, resource } = props;
  const url = (path: string) => resourceUrl(site.config, path);
  const kind = resource.kind === "folder" ? `Folder, ${resource.files!.length} files` : kindLabels[resource.kind];
  const meta = [kind, resource.extension.toUpperCase(), formatSize(resource.size)].filter(Boolean).join(" · ");
  return (
    <article class="resource" data-kind={resource.kind}>
      <div class="resource-head">
        <span class="resource-icon">
          <Icon name={resourceIcon(resource)} />
        </span>
        <div>
          <strong>{resource.title}</strong>
          <small>{meta}</small>
        </div>
      </div>
      {resource.description && <p class="resource-description">{resource.description}</p>}
      <div class="resource-actions">
        {resource.kind === "skill" && (
          <>
            <Action url={url(resource.archivePath!)} icon="download" label="Download skill" download />
            <Action url={url(resource.skillFile!)} icon="eye" label="View SKILL.md" />
            <button type="button" class="resource-action" data-copy-skill={url(resource.archivePath!)}>
              <Icon name="copy" />
              <Icon name="check" />
              Copy install command
            </button>
          </>
        )}
        {resource.kind === "folder" && (
          <Action url={url(resource.archivePath!)} icon="download" label="Download folder" download />
        )}
        {!resource.archivePath && <Action url={url(resource.path)} icon="download" label="Download" download />}
        {resource.kind === "document" && <Action url={url(resource.path)} icon="eye" label="Open" />}
      </div>
      {resource.files && <FileBrowser site={site} resource={resource} />}
      {!resource.files && resource.code !== undefined && (
        <details class="resource-preview">
          <summary>
            <Icon name="chevron-right" />
            Preview
          </summary>
          {raw(renderCode(resource.code, resource.extension, resource.title))}
        </details>
      )}
    </article>
  );
}

/**
 * Renders the Resources section appended to a page: one card per attached
 * file, folder or skill. Empty when the page has none.
 */
export function resourcesSection(site: Site, page: Page) {
  if (page.resources.length === 0) {
    return "";
  }
  return String(
    <section class="resources">
      <h2 id="resources">
        <a class="anchor" href="#resources" aria-hidden="true" tabindex="-1">
          #
        </a>
        Resources
      </h2>
      <div class="resource-grid">
        {page.resources.map((resource) => (
          <ResourceCard site={site} resource={resource} />
        ))}
      </div>
    </section>,
  );
}
