-- Companion evidence links are navigation metadata; Pandoc handles the citation.
function Link(link)
  if link.target:match('^obsidian://study%-evidence') then return {} end
end
