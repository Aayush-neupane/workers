/** Build a LIKE pattern from raw user input: \%_ escaped so they match
 *  literally. All interpolated SQL fragments elsewhere are fixed strings;
 *  this is the only place user text enters a LIKE — keep it that way. */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
