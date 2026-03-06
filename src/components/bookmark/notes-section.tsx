"use client";

import { MessageSquare, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { NOTES } from "@/lib/constants/notes-messages";

interface NotesSectionProps {
  notes: string;
  setNotes: (v: string) => void;
  isNotesExpanded: boolean;
  setIsNotesExpanded: (v: boolean) => void;
  errors: Record<string, string>;
  showExpandedSections: boolean;
}

export function NotesSection({
  notes,
  setNotes,
  isNotesExpanded,
  setIsNotesExpanded,
  errors,
  showExpandedSections,
}: NotesSectionProps) {
  return (
    <div
      className={`rounded-lg bg-purple-50/50 transition-all duration-300 ease-out ${
        showExpandedSections
          ? "opacity-100 max-h-[400px]"
          : "opacity-0 max-h-0 overflow-hidden"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsNotesExpanded(!isNotesExpanded)}
        aria-expanded={isNotesExpanded}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-purple-100/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4" />
          <span>{NOTES.SECTION.TITLE}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {NOTES.SECTION.SUBTITLE}
          </span>
        </div>
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${
            isNotesExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`px-3 pb-3 transition-all duration-200 ease-out ${
          isNotesExpanded
            ? "opacity-100 max-h-[300px]"
            : "opacity-0 max-h-0 overflow-hidden"
        }`}
      >
        <Textarea
          id="notes"
          placeholder={NOTES.SECTION.PLACEHOLDER}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`bg-white ${errors.notes ? "border-red-500" : ""}`}
        />
        {errors.notes && <p className="text-xs text-red-500">{errors.notes}</p>}
      </div>
    </div>
  );
}
