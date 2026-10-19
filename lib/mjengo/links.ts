/** Where a vault file opens: Word documents in the editor, PDFs in the PDF viewer, spreadsheets and decks in theirs. */
export function fileLink(name: string, id: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx') return `/dashboard/mjengo/documents/editor?file=${id}`;
  if (ext === 'excalidraw') return `/dashboard/mjengo/files/draw?file=${id}`;
  if (ext === 'pdf') return `/dashboard/mjengo/files/pdf?file=${id}`;
  if (['xlsx', 'xls', 'csv'].includes(ext)) return `/dashboard/mjengo/files/sheet?file=${id}`;
  if (['pptx', 'ppt'].includes(ext)) return `/dashboard/mjengo/files/slides?file=${id}`;
  return `/dashboard/mjengo/vault?open=${id}`;
}
