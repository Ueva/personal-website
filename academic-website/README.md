# Academic website

A small Jekyll site with HTML/Liquid templates, YAML content, Sass, and plain JavaScript. There is no JavaScript build step.

## Local commands

Install Ruby 3.3, Bundler, and Node.js (Node is used only by the syntax checks). From this directory, run `bundle install`.

- `./serve.ps1`: development server in `_site_dev`, including drafts and future posts; analytics is disabled.
- `./build.ps1`: builds production output in `_site` and runs all automated checks. Publish only after this command succeeds.
- `./check.ps1`: validates content and builds into a temporary directory. Does not change the site output.
- `./check.ps1 -PreviewUrl http://localhost:4000`: also checks the actual content served by the running preview against current sources.

The PowerShell scripts work from any working directory. On other systems, use `bundle exec jekyll serve --config _config.yaml,_config_dev.yaml`, `bundle exec ruby scripts/check.rb --build`, and `bundle exec ruby scripts/check.rb` from this directory. Add `--preview http://localhost:4000` to check a running preview.

Restart the development server after editing any `_config*.yaml` file: Jekyll does not reload configuration while serving. Development and production output are separate so a preview rebuild cannot overwrite the production build.

Before publishing, run the checks and inspect the affected pages on a phone-sized viewport and desktop. For navigation changes, also check Tab, Escape, and resizing across the mobile breakpoint while a link has focus; for citations, check clipboard-denied/manual copy. The automated checks are focused smoke checks, not a complete HTML or accessibility audit.

## Content and sources of truth

- `_config.yaml`: shared identity, affiliation, email addresses, research lab.
- `_data/profiles.yaml`: one list of public profile links (each with `id`, `label`, `username`, and `url`) used by Contact, the footer (`footer: true`), and structured metadata.
- `_data/papers/*.yaml`: one mapping per paper. Required: `title`, `type`, `date`, `description`, `reference`, `bibtex`, and the main URL (`paper`, or `preprint` for a preprint). `type` is `conference`, `journal`, `workshop`, or `preprint`. Optional: `supplement`, `preprint`, and `code`. Use a multiline `bibtex: |-` block. `_data/publication_groups.yaml` controls the section titles and category order.
- `_data/news/*.yaml`: one mapping per item, with `date` and `text`.
- `_data/software/*.yml`: one mapping per project, with `title`, `description`, and `url`.
- `_data/project_students.yaml`: a `students` list; each entry has `name`, `year` (academic year ending), `degree`, `thesis`, and optional `url`.
- `_data/phd_students.yaml`: a `students` list; `name` and a quoted `start_date` are required. Optional: `qualification`, `end_date`, `topics` (a list of strings), `thesis_title`, `thesis_link`, `url`, and `role`. Omit or leave `end_date` empty for current students. An end date makes the student former, regardless of today's date. Current students sort by start date, former students by end date, oldest first. Current thesis titles are labelled Provisional. Dates use `YYYY-MM-DD`.
- `_data/doctoral_supervision.yaml`: boolean `accepting_students`, open/closed messages, and a list of advertised opportunities (`title`, `url`).
- `_data/quotes.yaml`: a non-empty list of `text`/`author` strings. Text supports emphasis and line breaks. JavaScript selects a random initial quote on each page load; the first entry is the fallback without JavaScript. Rotation can be paused and starts paused for reduced-motion users.

Plain titles, names, references, and metadata are escaped in templates. Paper descriptions and news text intentionally support trusted HTML. Do not put untrusted user submissions in these fields. Quotes are trusted local content, rendered once with Jekyll Markdown, including emphasis and line breaks. The browser reuses this HTML; it does not implement a second formatter.

Keep local file URLs root-relative (for example `/assets/papers/example.pdf`). Templates apply `relative_url` where appropriate. Validation checks local HTML links, responsive image candidates, and CSS assets such as font files. The Featured Paper card is edited manually in `index.html`, so its wording can be tailored independently of publication entries.

## Styling and interactions

`assets/css/main.scss` loads the partials in `_sass`: self-hosted STIX2 fonts, theme tokens, base elements, layout, and components. Reuse `.card`, `.button`, and `.card-actions`. Keep layout rules in Sass rather than inline styles; add components only when existing ones do not fit.

Navigation is a normal disclosure on narrow screens, not a modal overlay. Without JavaScript the links remain visible. Theme state lives in memory, with optional localStorage persistence; `theme.js` runs before CSS to avoid an incorrect initial theme. Clipboard copying has a native details/textarea fallback, including without JavaScript.

All local CSS and JavaScript URLs go through `_includes/asset-url.html`, which adds a build version. Deploy the complete `_site` directory together. The version changes with every build to avoid stale assets; do not remove it from individual scripts.

The build uses only feed, sitemap, and last-modified Jekyll plugins. BibTeX and HTML parsing are validation dependencies, not page-rendering plugins. Checks compare rendered content with its data, require the manually edited featured card's title, summary, and link, and test that missing content/assets are rejected. Static assets are compared byte-for-byte with their sources. Keep `Gemfile.lock` committed. Analytics is configured in `_config_prod.yaml` and only rendered with `JEKYLL_ENV=production`.

## Fonts and portrait

STIX Two Text (variable weights 400?700, normal and italic) and STIX Two Math are served locally from `assets/fonts`, with their SIL Open Font Licences. The font files are the unmodified WOFF2 distributions from Google Fonts, v18 Text / v12 Math. Unicode subsets load only when used. `_sass/_fonts.scss` declares them; the primary Latin text face is preloaded in the shared head. Preserve the licences when updating fonts.

The original `assets/images/profile_pic.png` is retained for metadata and as a fallback. The homepage uses responsive 400px/800px WebP variants, native lazy loading, asynchronous decoding, and reserved square dimensions. When replacing the portrait, run `python scripts/optimise-portrait.py` after installing Pillow (`python -m pip install Pillow`). This is an optional asset-maintenance command; normal builds do not require Python or Pillow. If the original aspect ratio changes, also update the image dimensions and reserved aspect ratio in the homepage/layout.

The quote control is an icon with accessible Pause Quotes / Resume Quotes labels. Pausing preserves the remaining time and progress; returning from a hidden browser tab does the same.

The university profile link on the homepage is optional: removing the `university` profile displays the job title as plain text.
