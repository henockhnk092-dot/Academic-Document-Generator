export const APP_NAME = "AcademicGen";
export const APP_DESCRIPTION = "AI-Powered Academic Document Generator";

export const DOCUMENT_TYPES = {
  REPORT: "report",
  POWERPOINT: "powerpoint",
  CONFERENCE: "conference",
  THESIS: "thesis",
} as const;

export const TONE_OPTIONS = [
  { value: "academic", label: "Academic" },
  { value: "professional", label: "Professional" },
  { value: "essay", label: "Essay" },
  { value: "creative", label: "Creative" },
] as const;

export const CITATION_STYLES = [
  { value: "auto", label: "Auto-detect" },
  { value: "ieee", label: "IEEE (Numbered)" },
  { value: "harvard", label: "Harvard (Author-Date)" },
] as const;

export const FILE_TYPES = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
  IMAGE: "image/*",
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
