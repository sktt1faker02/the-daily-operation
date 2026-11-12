# Knowledge-transfer document build

Run from the repository root:

```powershell
node docs/knowledge-transfer/build/build.mjs
```

The script uses Node.js built-ins and Microsoft Edge installed on Windows. It
does not install or modify project dependencies. It reads the Markdown files
for completed phases, adds divider pages for phases not started, creates a
print-ready HTML file, then asks Edge to print the cumulative PDF.

Default Edge path:
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
If Edge is installed elsewhere, set `EDGE_PATH` to its executable path before
running the script. A fresh temporary browser profile is created under this
`build/` folder and removed after a successful build.

Generated files are written to `docs/knowledge-transfer/`:

- `The-Daily-Operation-Knowledge-Transfer.html`
- `The-Daily-Operation-Knowledge-Transfer.pdf`

The HTML keeps the table of contents clickable. Page counts are measured by
printing each current section and counting PDF page objects, then the document
is printed again with page references. The script fails if the output cannot
be rendered or the resulting PDF page count is inconsistent.

Edge's print output contains clickable PDF link annotations, but it does not
create document-outline bookmarks. The current Phase 1 PDF has no outline
bookmarks. Embedded-font metadata was not verified. Visually inspect page
breaks and tables in a PDF viewer before distributing a release.
