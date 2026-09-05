"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getChapters, getTopics, type Chapter, type ProfileSubject, type Topic } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

const STORAGE_KEY = "medha.lessonContext";

type LessonState = {
  gradeId: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
};

const EMPTY: LessonState = { gradeId: null, subjectId: null, chapterId: null, topicId: null };

type LessonContextValue = LessonState & {
  ready: boolean;
  setGradeSubject: (gradeId: string, subjectId: string) => void;
  setChapter: (chapterId: string | null) => void;
  setTopic: (topicId: string | null) => void;
  options: { pairs: ProfileSubject[]; chapters: Chapter[]; topics: Topic[] };
};

const LessonContext = createContext<LessonContextValue | null>(null);

function readInitial(): LessonState {
  // The (app) subtree renders null until client-side auth resolves, so this
  // lazy initializer only ever runs with `window` present -- no SSR mismatch.
  if (typeof window === "undefined") return EMPTY;
  let stored: LessonState = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<LessonState>) };
  } catch {
    /* ignore */
  }
  const p = new URLSearchParams(window.location.search);
  return {
    gradeId: p.get("grade") ?? stored.gradeId,
    subjectId: p.get("subject") ?? stored.subjectId,
    chapterId: p.get("chapter") ?? stored.chapterId,
    topicId: p.get("topic") ?? stored.topicId,
  };
}

function persist(s: LessonState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  const p = new URLSearchParams(window.location.search);
  const entries: [string, string | null][] = [
    ["grade", s.gradeId],
    ["subject", s.subjectId],
    ["chapter", s.chapterId],
    ["topic", s.topicId],
  ];
  for (const [k, v] of entries) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const qs = p.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

const FALLBACK_PAIRS: ProfileSubject[] = [
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "science-10", subject_name: "Science (विज्ञान)", is_primary: true },
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "maths-10", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "social-10", subject_name: "Social Science (सामाजिक विज्ञान)" },
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "hindi-10", subject_name: "Hindi (हिंदी)" },
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "english-10", subject_name: "English (अंग्रेज़ी)" },
  { grade_id: "class-10", grade_label: "Class 10", numeric_level: 10, subject_id: "sanskrit-10", subject_name: "Sanskrit (संस्कृत)" },
  { grade_id: "class-9", grade_label: "Class 9", numeric_level: 9, subject_id: "science-9", subject_name: "Science (विज्ञान)" },
  { grade_id: "class-9", grade_label: "Class 9", numeric_level: 9, subject_id: "maths-9", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-9", grade_label: "Class 9", numeric_level: 9, subject_id: "social-9", subject_name: "Social Science (सामाजिक विज्ञान)" },
  { grade_id: "class-9", grade_label: "Class 9", numeric_level: 9, subject_id: "hindi-9", subject_name: "Hindi (हिंदी)" },
  { grade_id: "class-9", grade_label: "Class 9", numeric_level: 9, subject_id: "english-9", subject_name: "English (अंग्रेज़ी)" },
  { grade_id: "class-8", grade_label: "Class 8", numeric_level: 8, subject_id: "science-8", subject_name: "Science (विज्ञान)" },
  { grade_id: "class-8", grade_label: "Class 8", numeric_level: 8, subject_id: "maths-8", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-7", grade_label: "Class 7", numeric_level: 7, subject_id: "science-7", subject_name: "Science (विज्ञान)" },
  { grade_id: "class-7", grade_label: "Class 7", numeric_level: 7, subject_id: "maths-7", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-6", grade_label: "Class 6", numeric_level: 6, subject_id: "science-6", subject_name: "Science (विज्ञान)" },
  { grade_id: "class-6", grade_label: "Class 6", numeric_level: 6, subject_id: "maths-6", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-11", grade_label: "Class 11", numeric_level: 11, subject_id: "physics-11", subject_name: "Physics (भौतिकी)" },
  { grade_id: "class-11", grade_label: "Class 11", numeric_level: 11, subject_id: "chem-11", subject_name: "Chemistry (रसायन)" },
  { grade_id: "class-11", grade_label: "Class 11", numeric_level: 11, subject_id: "maths-11", subject_name: "Mathematics (गणित)" },
  { grade_id: "class-12", grade_label: "Class 12", numeric_level: 12, subject_id: "physics-12", subject_name: "Physics (भौतिकी)" },
  { grade_id: "class-12", grade_label: "Class 12", numeric_level: 12, subject_id: "chem-12", subject_name: "Chemistry (रसायन)" },
  { grade_id: "class-12", grade_label: "Class 12", numeric_level: 12, subject_id: "maths-12", subject_name: "Mathematics (गणित)" },
];

const FALLBACK_CHAPTERS: Chapter[] = [
  { id: "ch-1", chapter_number: 1, title: "Chemical Reactions and Equations (रासायनिक अभिक्रियाएँ)" },
  { id: "ch-2", chapter_number: 2, title: "Acids, Bases and Salts (अम्ल, क्षारक एवं लवण)" },
  { id: "ch-3", chapter_number: 3, title: "Metals and Non-metals (धातु एवं अधातु)" },
  { id: "ch-4", chapter_number: 4, title: "Life Processes - Nutrition & Respiration (जैव प्रक्रम)" },
  { id: "ch-5", chapter_number: 5, title: "Control and Coordination (नियंत्रण एवं समन्वय)" },
  { id: "ch-6", chapter_number: 6, title: "Light - Reflection & Refraction (प्रकाश का परावर्तन)" },
  { id: "ch-7", chapter_number: 7, title: "Electricity & Circuits (विद्युत एवं परिपथ)" },
  { id: "ch-8", chapter_number: 8, title: "Real Numbers & Polynomials (वास्तविक संख्याएँ)" },
  { id: "ch-9", chapter_number: 9, title: "Linear Equations & Quadratic Form (समीकरण)" },
];

export function LessonProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const pairs = useMemo(() => {
    if (profile?.subjects && profile.subjects.length > 0) {
      return profile.subjects;
    }
    return FALLBACK_PAIRS;
  }, [profile]);

  const [state, setState] = useState<LessonState>(() => {
    const init = readInitial();
    if (!init.gradeId || !init.subjectId) {
      return {
        gradeId: "class-10",
        subjectId: "science-10",
        chapterId: "ch-4",
        topicId: null,
      };
    }
    return init;
  });
  const [chaptersFetched, setChaptersFetched] = useState<Chapter[]>([]);
  const [topicsFetched, setTopicsFetched] = useState<Topic[]>([]);

  if (pairs.length > 0) {
    const valid =
      state.gradeId != null &&
      state.subjectId != null &&
      pairs.some((p) => p.grade_id === state.gradeId && p.subject_id === state.subjectId);
    if (!valid) {
      const primary = pairs.find((p) => p.is_primary) ?? pairs[0];
      if (state.gradeId !== primary.grade_id || state.subjectId !== primary.subject_id) {
        setState({
          gradeId: primary.grade_id,
          subjectId: primary.subject_id,
          chapterId: FALLBACK_CHAPTERS[0].id,
          topicId: null,
        });
      }
    }
  }

  useEffect(() => {
    persist(state);
  }, [state]);

  // chapters for the current (grade, subject); gated at read-time below
  useEffect(() => {
    if (!state.gradeId || !state.subjectId) return;
    let cancelled = false;
    getChapters(state.gradeId, state.subjectId)
      .then((c) => !cancelled && setChaptersFetched(c))
      .catch(() => !cancelled && setChaptersFetched([]));
    return () => {
      cancelled = true;
    };
  }, [state.gradeId, state.subjectId]);

  // topics for the current chapter (auto-pick when there's only one)
  useEffect(() => {
    const chapterId = state.chapterId;
    if (!chapterId) return;
    let cancelled = false;
    getTopics(chapterId)
      .then((t) => {
        if (cancelled) return;
        setTopicsFetched(t);
        setState((s) =>
          s.chapterId === chapterId && !s.topicId && t.length === 1
            ? { ...s, topicId: t[0].id }
            : s,
        );
      })
      .catch(() => !cancelled && setTopicsFetched([]));
    return () => {
      cancelled = true;
    };
  }, [state.chapterId]);

  // A stale fetched list must not leak once its key changes.
  const chapters =
    chaptersFetched.length > 0
      ? chaptersFetched
      : FALLBACK_CHAPTERS;
  const topics = state.chapterId ? topicsFetched : [];

  const setGradeSubject = useCallback((gradeId: string, subjectId: string) => {
    setState({ gradeId, subjectId, chapterId: null, topicId: null });
  }, []);
  const setChapter = useCallback((chapterId: string | null) => {
    setState((s) => ({ ...s, chapterId, topicId: null }));
  }, []);
  const setTopic = useCallback((topicId: string | null) => {
    setState((s) => ({ ...s, topicId }));
  }, []);

  const value: LessonContextValue = {
    ...state,
    ready: state.gradeId != null && state.subjectId != null,
    setGradeSubject,
    setChapter,
    setTopic,
    options: { pairs, chapters, topics },
  };

  return <LessonContext.Provider value={value}>{children}</LessonContext.Provider>;
}

export function useLessonContext(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLessonContext must be used within a LessonProvider");
  return ctx;
}
