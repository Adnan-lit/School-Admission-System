const BANGLA_ZERO = '০'.charCodeAt(0)

/** Converts any Bangla digits in the text to 0-9. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - BANGLA_ZERO))
}
