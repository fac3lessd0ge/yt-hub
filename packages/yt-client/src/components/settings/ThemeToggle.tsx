import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

type ThemeValue = (typeof options)[number]["value"];

interface ThemeToggleProps {
  value: ThemeValue;
  onChange: (value: ThemeValue) => void;
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <fieldset className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
      <legend className="sr-only">Theme</legend>
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </label>
        );
      })}
    </fieldset>
  );
}
