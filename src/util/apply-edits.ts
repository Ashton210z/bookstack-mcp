// Targeted find-and-replace for edit_page. update_page needs the whole body
// resent, which on a large page is expensive and invites the caller to alter
// text it never meant to touch. Each edit here must match exactly once, so an
// ambiguous or stale `old_text` fails instead of landing in the wrong place.

export interface PageEdit {
  old_text: string;
  new_text: string;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) {
    count++;
  }
  return count;
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 80 ? `${oneLine.substring(0, 80)}...` : oneLine;
}

// Applies edits in order, each against the result of the previous one.
// Throws on the first edit that does not match exactly once, so the caller
// can abort before writing anything.
export function applyEdits(source: string, edits: PageEdit[]): string {
  let out = source;
  edits.forEach((edit, i) => {
    if (!edit.old_text) {
      throw new Error(`Edit ${i}: old_text is empty`);
    }
    const count = countOccurrences(out, edit.old_text);
    if (count !== 1) {
      throw new Error(
        `Edit ${i}: old_text matched ${count} times; it must match exactly once ` +
        `(add surrounding text to make it unique). old_text: "${preview(edit.old_text)}"`
      );
    }
    // Splice rather than String.replace, which would expand `$&`-style
    // patterns in new_text.
    const at = out.indexOf(edit.old_text);
    out = out.substring(0, at) + edit.new_text + out.substring(at + edit.old_text.length);
  });
  return out;
}
