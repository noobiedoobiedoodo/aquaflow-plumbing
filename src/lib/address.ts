/**
 * Normalizes address components to prevent duplicate database records.
 * Lowers cases, removes common punctuation, and trims whitespace.
 */
export function normalizeAddress(
  street: string,
  city: string,
  province: string,
  postalCode: string
) {
  const normStreet = street
    .toLowerCase()
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  const normCity = city
    .toLowerCase()
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  const normProvince = province.toUpperCase().trim();
  
  // Strip all spaces from postal code and make uppercase (e.g. "R3C 1A1" -> "R3C1A1")
  const normPostalCode = postalCode.toUpperCase().replace(/\s+/g, '').trim();

  return { normStreet, normCity, normProvince, normPostalCode };
}
