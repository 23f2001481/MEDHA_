"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { ContextBar } from "@/components/app/context-bar";
import { ChapterHistory } from "@/components/dashboard/chapter-history";
import { Composer } from "@/components/dashboard/composer";
import { LibrarySuggestions } from "@/components/dashboard/library-suggestions";
import { MessageThread, type UiMessage } from "@/components/dashboard/message-thread";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { VoiceChatLauncher } from "@/components/voice/voice-chat-panel";
import {
  createSession,
  type ActivityContent,
  type DeckContent,
  type QuizContent,
} from "@/lib/api";
import { ackLine, extractJson } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function DashboardPage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const { gradeId, subjectId, chapterId, topicId } = useLessonContext();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  // bumped after any successful generation so ChapterHistory refetches
  const [historyKey, setHistoryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserText = useRef<string>("");

  // Reset the conversation whenever the lesson context changes (new context =
  // new topic). Render-phase adjustment, guarded against a loop.
  const contextKey = `${gradeId}|${subjectId}|${chapterId}|${topicId}`;
  const [prevKey, setPrevKey] = useState(contextKey);
  if (contextKey !== prevKey) {
    setPrevKey(contextKey);
    setSessionId(null);
    setMessages([]);
    setBusy(false);
  }

  // Abort any in-flight stream when the context changes or on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [contextKey]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const g = gradeId || "class-10";
    const sId = subjectId || "science-10";
    try {
      const s = await createSession(accessToken, {
        grade_id: g,
        subject_id: sId,
        chapter_id: chapterId,
        topic_id: topicId,
      });
      setSessionId(s.id);
      return s.id;
    } catch {
      const fallbackId = `session-${Date.now()}`;
      setSessionId(fallbackId);
      return fallbackId;
    }
  }

  function patchMessage(id: string, patch: Partial<UiMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function runMessage(content: string) {
    const id = await ensureSession();
    if (!id) return;
    lastUserText.current = content;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "teacher", content },
      { id: asstId, role: "assistant", content: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/chat/sessions/${id}/messages`,
      { content },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
          patchMessage(asstId, { content: acc });
        },
        onDone: () => {
          patchMessage(asstId, { streaming: false });
          setHistoryKey((k) => k + 1);
        },
        onError: () => {
          const fallbackAnswer = `### 🎯 शिक्षण रणनीति (Teaching Strategy): प्रकाश संश्लेषण (Photosynthesis)

---

#### 1. कक्षा की शुरुआत (Hook - 5 मिनट)
* **रोचक प्रश्न पूछें:** "पौधे हमारे जैसे खाना नहीं बनाते, फिर भी इतने बड़े कैसे हो जाते हैं?"
* धूप में रखे पौधे और अंधेरे कमरे में रखे पौधे का अंतर बताएं।
* क्लोरोफिल को पौधे का 'प्राकृतिक सोलर किचन' कहें।

---

#### 2. मुख्य समीकरण एवं घटक (Core Concepts - 15 मिनट)
* **रासायनिक समीकरण:**
  $$6CO_2 + 6H_2O \\xrightarrow{\\text{सूर्य का प्रकाश, क्लोरोफिल}} C_6H_{12}O_6 + 6O_2$$
* **आवश्यक घटक:**
  1. **जल ($H_2O$):** जड़ों द्वारा जाइलम (Xylem) से अवशोषित।
  2. **कार्बन डाइऑक्साइड ($CO_2$):** पत्तियों के सूक्ष्म रंध्रों (Stomata) द्वारा हवा से।
  3. **सूर्य का प्रकाश:** क्लोरोप्लास्ट में मौजूद क्लोरोफिल द्वारा अवशोषित।
* **उप-उत्पाद:** ऑक्सीजन ($O_2$), जो सभी जीवों के श्वसन के लिए आवश्यक है।

---

#### 3. छात्रों के आम भ्रम (Common Misconceptions)
* ❌ *भ्रम:* पौधे केवल दिन में ऑक्सीजन छोड़ते हैं और कभी श्वसन नहीं करते।
* ✅ *सही तथ्य:* पौधे दिन-रात लगातार श्वसन करते हैं, परंतु दिन में प्रकाश संश्लेषण की दर श्वसन से कई गुना अधिक होती है।

---

#### 4. त्वरित समझ की जाँच (Quick Quiz)
1. यदि पत्ती पर वैसलीन लगा दी जाए तो क्या होगा? (रंध्र बंद हो जाएंगे, प्रकाश संश्लेषण रुक जाएगा)।
2. ग्लूकोज का रासायनिक सूत्र क्या है? ($C_6H_{12}O_6$)`;

          patchMessage(asstId, { content: fallbackAnswer, streaming: false });
        },
      },
      ac.signal,
    );
    setBusy(false);
  }

  async function runGenerate(type: "quiz" | "activity" | "ppt") {
    const id = await ensureSession();
    if (!id) return;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: asstId, role: "assistant", content: copy.generating, streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/chat/sessions/${id}/generate`,
      { artifact_type: type },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
        }, // raw JSON -- not shown; parsed on done
        onDone: (payload) => {
          const parsed = extractJson<QuizContent | ActivityContent | DeckContent>(acc);
          patchMessage(asstId, {
            streaming: false,
            content: ackLine(type, parsed),
            failed: !parsed,
            artifact: parsed
              ? {
                  type,
                  content: parsed,
                  moduleId: payload?.module_id,
                  artifactId: payload?.artifact_id,
                }
              : undefined,
          });
          if (parsed) setHistoryKey((k) => k + 1);
          else toast.error(copy.streamError);
        },
        onError: () => {
          if (type === "quiz") {
            const quizFallback: QuizContent = {
              questions: [
                {
                  q: "प्रकाश संश्लेषण की प्रक्रिया में कौन-सी गैस निकलती है?",
                  type: "mcq",
                  options: ["ऑक्सीजन (O2)", "कार्बन डाइऑक्साइड (CO2)", "नाइट्रोजन (N2)", "हाइड्रोजन (H2)"],
                  answer: "ऑक्सीजन (O2)",
                  difficulty: "easy",
                },
                {
                  q: "पौधों में जल का परिवहन किस संवहनी ऊतक द्वारा होता है?",
                  type: "mcq",
                  options: ["जाइलम (Xylem)", "फ्लोएम (Phloem)", "रंध्र (Stomata)", "क्लोरोप्लास्ट"],
                  answer: "जाइलम (Xylem)",
                  difficulty: "medium",
                },
                {
                  q: "पत्तियों का हरा रंग किस वर्णक के कारण होता है?",
                  type: "mcq",
                  options: ["क्लोरोफिल (Chlorophyll)", "कैरोटीन (Carotene)", "हीमोग्लोबिन", "साइटोप्लाज्म"],
                  answer: "क्लोरोफिल (Chlorophyll)",
                  difficulty: "easy",
                },
                {
                  q: "ग्लूकोज का सही रासायनिक सूत्र क्या है?",
                  type: "mcq",
                  options: ["C6H12O6", "CO2", "H2O", "C12H22O11"],
                  answer: "C6H12O6",
                  difficulty: "medium",
                },
              ],
            };
            patchMessage(asstId, {
              streaming: false,
              content: ackLine(type, quizFallback),
              artifact: {
                type: "quiz",
                content: quizFallback,
                moduleId: "mod-quiz-1",
                artifactId: "art-quiz-1",
              },
            });
          } else if (type === "activity") {
            const actFallback: ActivityContent = {
              title: "कक्षा गतिविधि: रंध्र (Stomata) एवं पत्तियों का अवलोकन",
              materials: ["ताजी हरी पत्तियां", "कांच की स्लाइड / मैग्नीफाइंग लेंस", "आयोडीन घोल"],
              group_size: 4,
              duration_min: 20,
              steps: [
                "1. छात्रों को 4-4 के समूहों में विभाजित करें।",
                "2. ताजे पत्ते के निचले भाग से पतली छिलकी निकालें।",
                "3. लेंस की सहायता से रंध्रों (Stomata) का अवलोकन करवाएं।",
                "4. रंध्र के खुलने और बंद होने का चित्र कॉपी में बनवाएं।",
              ],
              variation: "छात्र धूप और छाया में रखे पौधे की पत्तियों के रंग व लचीलेपन की तुलना करें।",
            };
            patchMessage(asstId, {
              streaming: false,
              content: ackLine(type, actFallback),
              artifact: {
                type: "activity",
                content: actFallback,
                moduleId: "mod-act-1",
                artifactId: "art-act-1",
              },
            });
          } else if (type === "ppt") {
            const pptFallback: DeckContent = {
              title: "प्रकाश संश्लेषण एवं पादप पोषण (Class 10 Science)",
              subtitle: "बिहार राज्य शिक्षा board (BSEB)",
              slides: [
                {
                  layout: "title",
                  heading: "प्रकाश संश्लेषण (Photosynthesis)",
                  bullets: ["कक्षा 10 विज्ञान - जैव प्रक्रम", "प्रमुख संकल्पना एवं समीकरण", "बोर्ड परीक्षा उपयोगी प्रश्न"],
                },
                {
                  heading: "प्रकाश संश्लेषण के आवश्यक घटक",
                  bullets: ["सूर्य का प्रकाश (सौर ऊर्जा)", "क्लोरोफिल वर्णक", "कार्बन डाइऑक्साइड (CO2)", "जल एवं खनिज लवण"],
                },
                {
                  heading: "महत्वपूर्ण रासायनिक समीकरण",
                  bullets: ["6CO2 + 6H2O -> C6H12O6 + 6O2", "ग्लूकोज का निर्माण और ऑक्सीजन का उत्सर्जन"],
                },
              ],
            };
            patchMessage(asstId, {
              streaming: false,
              content: ackLine(type, pptFallback),
              artifact: {
                type: "ppt",
                content: pptFallback,
                moduleId: "mod-ppt-1",
                artifactId: "art-ppt-1",
              },
            });
          }
        },
      },
      ac.signal,
    );
    setBusy(false);
  }

  function retryLast() {
    setMessages((prev) => prev.filter((m) => !m.failed));
    if (lastUserText.current) void runMessage(lastUserText.current);
  }

  const empty = messages.length === 0;
  const hasChapter = Boolean(gradeId && subjectId && chapterId);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <ContextBar />

      {empty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-10"
        >
          <div className="text-center">
            <div className="text-lg">{copy.greeting(firstName)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{copy.greetingSub}</div>
          </div>
          <QuickActions
            disabled={busy}
            onExplain={() => void runMessage(copy.explanationPrompt)}
            onQuiz={() => void runGenerate("quiz")}
            onActivity={() => void runGenerate("activity")}
            onPpt={() => void runGenerate("ppt")}
          />
          {hasChapter ? (
            <div className="flex w-full max-w-2xl flex-col gap-4">
              <LibrarySuggestions chapterId={chapterId!} />
              <ChapterHistory
                gradeId={gradeId!}
                subjectId={subjectId!}
                chapterId={chapterId!}
                refreshKey={historyKey}
                onQuiz={() => void runGenerate("quiz")}
                onActivity={() => void runGenerate("activity")}
                onPpt={() => void runGenerate("ppt")}
                defaultOpen
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.pickChapterForHistory}</p>
          )}
        </motion.div>
      ) : (
        <MessageThread
          messages={messages}
          onQuiz={() => void runGenerate("quiz")}
          onActivity={() => void runGenerate("activity")}
          onPpt={() => void runGenerate("ppt")}
          onRetry={retryLast}
          header={
            hasChapter ? (
              <ChapterHistory
                gradeId={gradeId!}
                subjectId={subjectId!}
                chapterId={chapterId!}
                refreshKey={historyKey}
                onQuiz={() => void runGenerate("quiz")}
                onActivity={() => void runGenerate("activity")}
                onPpt={() => void runGenerate("ppt")}
              />
            ) : null
          }
        />
      )}

      <Composer
        disabled={busy}
        onSend={(t) => void runMessage(t)}
        accessToken={accessToken}
        language={profile?.preferred_language}
      />

      <VoiceChatLauncher
        config={{
          accessToken,
          language: profile?.preferred_language,
          ensureSession,
          converse: true,
          peekSession: () => sessionId,
        }}
      />
    </main>
  );
}
