function unwrapExtendedDate(value) {
  if (value instanceof Date) return value;

  if (value && typeof value === "object" && "$date" in value) {
    return unwrapExtendedDate(value.$date);
  }

  if (value && typeof value === "object" && "$numberLong" in value) {
    return value.$numberLong;
  }

  return value;
}

export function readExtendedJsonDate(value) {
  const unwrapped = unwrapExtendedDate(value);
  let date;

  if (unwrapped instanceof Date) {
    date = unwrapped;
  } else if (typeof unwrapped === "number") {
    date = new Date(unwrapped);
  } else if (typeof unwrapped === "string" && unwrapped.length > 0) {
    date = /^-?\d+$/.test(unwrapped)
      ? new Date(Number(unwrapped))
      : new Date(unwrapped);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
