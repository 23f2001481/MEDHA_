"use client";

import { Select, type SelectOption } from "@/components/ui/select";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";

export function ContextBar() {
  const copy = useCopy();
  const t = useCurriculumT();
  const { gradeId, subjectId, chapterId, options, setGradeSubject, setChapter } =
    useLessonContext();
  const { pairs, chapters } = options;

  const gradeOptions: SelectOption[] = [];
  const gradeSeen = new Map<string, number>();
  for (const p of pairs) {
    if (!gradeSeen.has(p.grade_id)) {
      gradeSeen.set(p.grade_id, p.numeric_level);
      gradeOptions.push({ value: p.grade_id, label: t.grade(p.grade_label) });
    }
  }
  gradeOptions.sort((a, b) => (gradeSeen.get(a.value) ?? 0) - (gradeSeen.get(b.value) ?? 0));

  // Fallback if pairs has no grades
  if (gradeOptions.length === 0) {
    gradeOptions.push(
      { value: "class-10", label: "Class 10" },
      { value: "class-9", label: "Class 9" },
      { value: "class-8", label: "Class 8" },
      { value: "class-7", label: "Class 7" },
      { value: "class-6", label: "Class 6" },
      { value: "class-11", label: "Class 11" },
      { value: "class-12", label: "Class 12" },
    );
  }

  const subjectOptions: SelectOption[] = [];
  const subjectSeen = new Set<string>();
  for (const p of pairs) {
    if ((!gradeId || p.grade_id === gradeId) && !subjectSeen.has(p.subject_id)) {
      subjectSeen.add(p.subject_id);
      subjectOptions.push({ value: p.subject_id, label: t.subject(p.subject_name) });
    }
  }

  // Fallback if no subjects found
  if (subjectOptions.length === 0) {
    subjectOptions.push(
      { value: "science-10", label: "Science (विज्ञान)" },
      { value: "maths-10", label: "Mathematics (गणित)" },
      { value: "social-10", label: "Social Science (सामाजिक विज्ञान)" },
      { value: "hindi-10", label: "Hindi (हिंदी)" },
      { value: "english-10", label: "English (अंग्रेज़ी)" },
      { value: "sanskrit-10", label: "Sanskrit (संस्कृत)" },
    );
  }

  const chapterOptions: SelectOption[] =
    chapters.length > 0
      ? chapters.map((c) => ({
          value: c.id,
          label: t.chapter(c.title),
        }))
      : [
          { value: "ch-1", label: "Chemical Reactions and Equations (रासायनिक अभिक्रियाएँ)" },
          { value: "ch-2", label: "Acids, Bases and Salts (अम्ल, क्षारक एवं लवण)" },
          { value: "ch-3", label: "Life Processes (जैव प्रक्रम)" },
          { value: "ch-4", label: "Light - Reflection & Refraction (प्रकाश)" },
          { value: "ch-5", label: "Electricity (विद्युत धारा)" },
          { value: "ch-6", label: "Real Numbers (वास्तविक संख्याएँ)" },
        ];

  function pickGrade(nextGrade: string) {
    const keep = pairs.find((p) => p.grade_id === nextGrade && p.subject_id === subjectId);
    const next = keep ?? pairs.find((p) => p.grade_id === nextGrade);
    if (next) {
      setGradeSubject(next.grade_id, next.subject_id);
    } else {
      setGradeSubject(nextGrade, subjectId || "science-10");
    }
  }

  function pickSubject(nextSubject: string) {
    setGradeSubject(gradeId || "class-10", nextSubject);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <Select
        ariaLabel={copy.selectClass}
        placeholder={copy.selectClass}
        value={gradeId}
        options={gradeOptions}
        onValueChange={pickGrade}
      />
      <Select
        ariaLabel={copy.selectSubject}
        placeholder={copy.selectSubject}
        value={subjectId}
        options={subjectOptions}
        onValueChange={pickSubject}
      />
      <Select
        ariaLabel={copy.selectChapter}
        placeholder={copy.selectChapter}
        value={chapterId}
        options={chapterOptions}
        onValueChange={(c) => setChapter(c)}
        className="max-w-[16rem]"
      />
    </div>
  );
}
