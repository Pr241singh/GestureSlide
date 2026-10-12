// Checks and messages for a file the user picked. This module does not load PDF.js.

export function isPdfFile(file) {
  const name = typeof file?.name === 'string' ? file.name.toLowerCase() : ''
  const type = typeof file?.type === 'string' ? file.type.toLowerCase() : ''

  if (type === 'application/pdf' || type === 'application/x-pdf') {
    return true
  }

  // Some browsers leave the type empty, or use a generic byte type, for a .pdf file.
  return name.endsWith('.pdf')
}

export function pdfErrorMessage(error) {
  const name = error?.name

  if (name === 'PasswordException') {
    return 'This PDF is password-protected. GestureSlide cannot open it.'
  }

  if (name === 'InvalidPDFException') {
    return 'This file is not a readable PDF. It may be damaged, or it may not be a PDF.'
  }

  if (name === 'RenderingCancelledException') {
    return ''
  }

  const detail = typeof error?.message === 'string' ? error.message.trim() : ''
  if (detail) {
    return `Could not open this PDF. ${detail}`
  }

  return 'Could not open this PDF.'
}
