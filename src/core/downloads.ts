export function downloadTextFile(
  filename: string,
  content: string,
  contentType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
