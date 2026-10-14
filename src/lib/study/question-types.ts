export type QuestionSection = "speaking-writing" | "reading" | "listening";
export type QuestionPriority = "P1" | "P2" | "P3";

export type QuestionType = {
  key: string;
  number: number;
  code: string;
  label: string;
  section: QuestionSection;
  priority: QuestionPriority;
  href: string;
};

export const QUESTION_SECTIONS: ReadonlyArray<{
  key: QuestionSection;
  label: string;
}> = [
  { key: "speaking-writing", label: "Speaking & Writing" },
  { key: "reading", label: "Reading" },
  { key: "listening", label: "Listening" },
];

// Keys and codes match the canonical mapping in tools/data_layout.py.
export const QUESTION_TYPES: ReadonlyArray<QuestionType> = [
  { key: "01-ra", number: 1, code: "ra", label: "Read Aloud", section: "speaking-writing", priority: "P2", href: "/study/01-ra" },
  { key: "02-rs", number: 2, code: "rs", label: "Repeat Sentence", section: "speaking-writing", priority: "P1", href: "/study/02-rs" },
  { key: "03-di", number: 3, code: "di", label: "Describe Image", section: "speaking-writing", priority: "P1", href: "/study/03-di" },
  { key: "04-rl", number: 4, code: "rl", label: "Retell Lecture", section: "speaking-writing", priority: "P1", href: "/study/04-rl" },
  { key: "05-asq", number: 5, code: "asq", label: "Answer Short Question", section: "speaking-writing", priority: "P3", href: "/study/05-asq" },
  { key: "06-sgd", number: 6, code: "sgd", label: "Summarize Group Discussion", section: "speaking-writing", priority: "P1", href: "/study/06-sgd" },
  { key: "07-rts", number: 7, code: "rts", label: "Respond to a Situation", section: "speaking-writing", priority: "P1", href: "/study/07-rts" },
  { key: "08-swt", number: 8, code: "swt", label: "Summarize Written Text", section: "speaking-writing", priority: "P1", href: "/study/08-swt" },
  { key: "09-we", number: 9, code: "we", label: "Write Essay", section: "speaking-writing", priority: "P1", href: "/study/09-we" },
  { key: "10-fib-r-dropdown", number: 10, code: "fib-r-d", label: "Reading FIB Dropdown", section: "reading", priority: "P1", href: "/study/10-fib-r-dropdown" },
  { key: "11-mcma-r", number: 11, code: "mcma-r", label: "Reading MC Multiple Answers", section: "reading", priority: "P3", href: "/study/11-mcma-r" },
  { key: "12-rop", number: 12, code: "rop", label: "Reorder Paragraph", section: "reading", priority: "P2", href: "/study/12-rop" },
  { key: "13-fib-r-drag-and-drop", number: 13, code: "fib-r-dd", label: "Reading FIB Drag & Drop", section: "reading", priority: "P1", href: "/study/13-fib-r-drag-and-drop" },
  { key: "14-mcsa-r", number: 14, code: "mcsa-r", label: "Reading MC Single Answer", section: "reading", priority: "P3", href: "/study/14-mcsa-r" },
  { key: "15-sst", number: 15, code: "sst", label: "Summarize Spoken Text", section: "listening", priority: "P1", href: "/study/15-sst" },
  { key: "16-mcma-l", number: 16, code: "mcma-l", label: "Listening MC Multiple Answers", section: "listening", priority: "P3", href: "/study/16-mcma-l" },
  { key: "17-fib-l", number: 17, code: "fib-l", label: "Listening FIB Type In", section: "listening", priority: "P2", href: "/study/17-fib-l" },
  { key: "18-hcs", number: 18, code: "hcs", label: "Highlight Correct Summary", section: "listening", priority: "P3", href: "/study/18-hcs" },
  { key: "19-mcsa-l", number: 19, code: "mcsa-l", label: "Listening MC Single Answer", section: "listening", priority: "P3", href: "/study/19-mcsa-l" },
  { key: "20-smw", number: 20, code: "smw", label: "Select Missing Word", section: "listening", priority: "P3", href: "/study/20-smw" },
  { key: "21-hiw", number: 21, code: "hiw", label: "Highlight Incorrect Words", section: "listening", priority: "P2", href: "/study/21-hiw" },
  { key: "22-wfd", number: 22, code: "wfd", label: "Write From Dictation", section: "listening", priority: "P1", href: "/study/22-wfd" },
];

export const VOCABULARY_NAVIGATION = {
  label: "Vocabulary",
  href: "/vocabulary",
} as const;

export function getQuestionTypeByKey(key: string): QuestionType | undefined {
  return QUESTION_TYPES.find((questionType) => questionType.key === key);
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
