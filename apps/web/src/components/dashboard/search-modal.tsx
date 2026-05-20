"use client";

import * as React from "react";
import { Search, Command, FileText, Users, ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const recentSearches = [
  { id: 1, title: "Exam #2024-001", type: "exam", icon: FileText },
  { id: 2, title: "John Doe", type: "subject", icon: Users },
  { id: 3, title: "Case: Industrial Espionage", type: "case", icon: ShieldCheck },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // This would be toggle logic in parent
      }
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-foreground/5"
        >
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              autoFocus
              className="flex h-14 w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search cases, subjects, or exams..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button 
              onClick={onClose}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {query.length === 0 ? (
              <div className="space-y-4 py-2">
                <div className="px-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    Recent Searches
                  </p>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        router.push(`/dashboard/${item.type}s` as any);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-primary/5 hover:text-primary text-foreground group"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/40">{item.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans font-medium">Enter</kbd>
              <span>to select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans font-medium">↑↓</kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans font-medium">Esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
