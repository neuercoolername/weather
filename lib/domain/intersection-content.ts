// One definition of "has something to show": written text.
export function hasContent(text: string | null): boolean {
  return !!text?.trim();
}
