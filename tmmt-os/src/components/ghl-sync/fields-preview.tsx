function previewValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function FieldsPreview({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields).slice(0, 4);
  if (entries.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <ul className="text-xs text-muted-foreground space-y-0.5 max-w-xs">
      {entries.map(([key, val]) => (
        <li key={key} className="truncate">
          <span className="text-foreground/80">{key}:</span> {previewValue(val)}
        </li>
      ))}
      {Object.keys(fields).length > 4 && (
        <li className="text-[10px]">+{Object.keys(fields).length - 4} more</li>
      )}
    </ul>
  );
}
