"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ACCOUNTING_PAGE_SIZES = [10, 25, 50, 100] as const;

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

type AccountingTablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizes?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
  className?: string;
};

export function AccountingTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizes = ACCOUNTING_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  label = "rows",
  className,
}: AccountingTablePaginationProps) {
  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border/50 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalItems)}
          </span>{" "}
          of {totalItems} {label}
        </p>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
            Per page
          </Label>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[72px] rounded-lg">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageNumbers.map((page, index) => {
            const prev = pageNumbers[index - 1];
            const showEllipsis = prev !== undefined && page - prev > 1;
            return (
              <React.Fragment key={page}>
                {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                <Button
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 rounded-lg text-xs font-semibold"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              </React.Fragment>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Keeps current page in range when filters shrink the result set. */
export function useAccountingPagination(totalItems: number, pageSize: number) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [totalItems, pageSize]);

  const sliceStart = (page - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;

  return { page, setPage, totalPages, sliceStart, sliceEnd };
}
