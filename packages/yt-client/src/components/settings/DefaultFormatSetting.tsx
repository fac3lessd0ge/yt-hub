import { useFormats } from "@/hooks/useFormats";
import type { FormatInfo } from "@/types/api";

interface DefaultFormatSettingProps {
  value: string;
  onChange: (format: string) => void;
}

export function DefaultFormatSetting({
  value,
  onChange,
}: DefaultFormatSettingProps) {
  const { formats, loading } = useFormats();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
    >
      {loading && <option>Loading formats...</option>}
      {formats.map((f: FormatInfo) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
