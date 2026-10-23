"use client";

import type { CrmStatus } from "@/types";
import { LEAD_STATUSES, CRM_STATUS_LABELS, CRM_STATUS_COLORS } from "@/lib/crm-helpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LeadStatusSelectProps {
  value: CrmStatus;
  onChange: (status: CrmStatus) => Promise<void>;
  disabled?: boolean;
}

export function LeadStatusSelect({
  value,
  onChange,
  disabled,
}: LeadStatusSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CrmStatus)}
      disabled={disabled}
    >
      <SelectTrigger className="h-7 text-xs border-0 p-0 shadow-none focus:ring-0 w-auto gap-1">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            CRM_STATUS_COLORS[value]
          )}
        >
          <SelectValue>{CRM_STATUS_LABELS[value]}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                CRM_STATUS_COLORS[s]
              )}
            >
              {CRM_STATUS_LABELS[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
