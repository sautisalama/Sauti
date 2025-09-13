export function normalizePhone(input: string | null | undefined, defaultCountry: 'KE' | null = 'KE'): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  // Replace common separators
  raw = raw.replace(/[()\s-]/g, '');
  // Convert 00 prefix to +
  if (raw.startsWith('00')) raw = '+' + raw.slice(2);
  // If already E.164-ish
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d+]/g, '').replace(/\+/g, (m, i) => (i === 0 ? '+' : '')).replace(/[^\d+]/g, '');
  // Remove any non-digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // Simple defaulting for KE (Kenya): 0XXXXXXXXX => +254XXXXXXXXX
  if (defaultCountry === 'KE') {
    if (digits.length === 10 && digits.startsWith('0')) {
      return '+254' + digits.slice(1);
    }
    if (digits.length === 9) {
      return '+254' + digits;
    }
  }
  // Fallback: if starts with country code missing plus and length >= 10
  if (digits.length >= 10) return '+' + digits;
  return '+' + digits; // last resort
}
