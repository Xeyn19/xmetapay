"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

export function ReportDownloadMenu({
  excelHref,
  pdfHref,
  reportName,
}: {
  excelHref: string;
  pdfHref: string;
  reportName: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-button-secondary bg-button-secondary px-3.5 text-[12.5px] font-semibold text-button-secondary-foreground transition hover:bg-button-secondary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Download className="size-4" />
        Download
        <ChevronDown className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" collisionPadding={16} className="z-[260]">
          <Menu.Popup className="w-48 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-xl outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <Menu.LinkItem
              href={excelHref}
              aria-label={`Download ${reportName} as Excel`}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground outline-none data-[highlighted]:bg-muted"
            >
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              Excel
            </Menu.LinkItem>
            <Menu.LinkItem
              href={pdfHref}
              aria-label={`Download ${reportName} as PDF`}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground outline-none data-[highlighted]:bg-muted"
            >
              <FileText className="size-4 text-primary" />
              PDF
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
