/**
 * AI 笔记服务模块
 *
 * @module ai-notes
 * @version 1.0.0
 * @since 2025-12-26
 */

export { NoteService, noteService, createNoteService } from "./note.service";

export type {
  NoteSourceType,
  ContentFormat,
  AINote,
  CreateNoteParams,
  UpdateNoteParams,
  SearchNotesParams,
  NoteServiceResult,
} from "./types";
