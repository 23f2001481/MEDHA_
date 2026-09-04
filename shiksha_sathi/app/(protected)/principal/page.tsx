"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MapPin,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveTeacher,
  getPendingTeachers,
  getPrincipalStats,
  getPrincipalTeachers,
  rejectTeacher,
  type PendingTeacher,
  type PrincipalStats,
  type TeacherRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BIHAR_SCHOOLS } from "@/lib/bihar-schools";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { StatGrid } from "@/components/console/stat-grid";
import { PendingTeachers } from "@/components/principal/pending-teachers";
import { TeacherRoster } from "@/components/principal/teacher-roster";

type SchoolProfile = {
  name: string;
  code: string;
  district: string;
  block?: string | null;
  joiningDate?: string | null;
  principalName?: string | null;
  experience?: string | number | null;
};

function PrincipalDashboard() {
  const { accessToken, teacher } = useAuth();

  const [stats, setStats] = useState<PrincipalStats | null>(null);
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // School information for Principal
  const [schoolInfo, setSchoolInfo] = useState<SchoolProfile>({
    name: "Govt. Girls High School Patna City",
    code: "10280105528",
    district: "Patna",
    block: "Patna City",
    joiningDate: "2023-06-15",
    principalName: teacher?.full_name || "Principal",
    experience: "15",
  });

  useEffect(() => {
    // 1. Try to read from localStorage (set during registration or demo)
    try {
      const saved = localStorage.getItem("medha_principal_school");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) {
          setSchoolInfo((prev) => ({
            ...prev,
            name: parsed.name,
            code: parsed.udise_code || parsed.code || "10280105528",
            district: parsed.district_name || parsed.district || "Patna",
            block: parsed.block_name || parsed.block || "Patna City",
            joiningDate: parsed.joining_date || prev.joiningDate,
            principalName: parsed.principal_name || teacher?.full_name || prev.principalName,
            experience: parsed.experience || prev.experience,
          }));
          return;
        }
      }
    } catch {
      // ignore
    }

    // 2. If teacher object has school_name or school_id
    if (teacher) {
      if (teacher.school_name) {
        setSchoolInfo((prev) => ({
          ...prev,
          name: teacher.school_name!,
          code: teacher.school_udise_code || teacher.school_code || prev.code,
        }));
      } else if (teacher.school_id) {
        const match = BIHAR_SCHOOLS.find((s) => s.id === teacher.school_id);
        if (match) {
          setSchoolInfo((prev) => ({
            ...prev,
            name: match.name,
            code: match.udise_code || prev.code,
            district: match.district_name,
            block: match.block_name,
          }));
        }
      }
    }
  }, [teacher]);

  const reload = useCallback(() => {
    return Promise.all([
      getPrincipalStats(accessToken),
      getPendingTeachers(accessToken),
      getPrincipalTeachers(accessToken),
    ])
      .then(([s, p, r]) => {
        setStats(s);
        setPending(p);
        setRoster(r);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load the dashboard.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function act(id: string, run: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ConsoleShell title="Principal" schoolName={schoolInfo.name}>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ══════════════════════════════════════════════════════════════
              OFFICIAL SCHOOL BANNER (Principal's School Identity)
          ══════════════════════════════════════════════════════════════ */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-900/10 bg-gradient-to-r from-[#0b3b78] via-[#082f63] to-[#061f43] p-6 text-white shadow-xl">
            {/* Background watermark badge */}
            <div className="pointer-events-none absolute -right-6 -bottom-6 text-white/5">
              <School className="size-48" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner backdrop-blur-sm border border-white/20">
                  <School className="size-8 text-amber-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                      {schoolInfo.name}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-400/30">
                      <CheckCircle2 className="size-3" /> Bihar Government School
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs md:text-sm text-blue-200">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-2.5 py-0.5 font-mono font-bold text-amber-300 border border-amber-400/30">
                      School Code (UDISE): {schoolInfo.code}
                    </span>
                    <span className="flex items-center gap-1 text-blue-100">
                      <MapPin className="size-3.5 text-blue-300" />
                      {schoolInfo.block ? `${schoolInfo.block}, ` : ""}
                      {schoolInfo.district}, Bihar
                    </span>
                  </div>
                </div>
              </div>

              {/* Principal profile mini-panel */}
              <div className="flex shrink-0 flex-col items-start md:items-end gap-1 rounded-xl bg-white/10 px-4 py-3 border border-white/15 backdrop-blur-sm">
                <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                  Principal in Charge
                </span>
                <strong className="text-sm font-bold text-white">
                  {teacher?.full_name || schoolInfo.principalName}
                </strong>
                {schoolInfo.joiningDate && (
                  <span className="text-xs text-amber-300 flex items-center gap-1">
                    <Calendar className="size-3" /> Joined: {schoolInfo.joiningDate}
                  </span>
                )}
                {schoolInfo.experience && (
                  <span className="text-xs text-blue-200">
                    Total Experience: {schoolInfo.experience} Years
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              STATISTICS
          ══════════════════════════════════════════════════════════════ */}
          {stats && (
            <StatGrid
              stats={[
                { label: "Approved teachers", value: stats.teachers },
                { label: "Pending applications", value: stats.pending_teachers },
              ]}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════
              TEACHER APPLICATIONS
          ══════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <Users className="size-4 text-blue-700" /> Teacher applications
              </h2>
              {pending.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  {pending.length} New
                </span>
              )}
            </div>
            <PendingTeachers
              teachers={pending}
              busyId={busyId}
              onApprove={(id) =>
                void act(id, () => approveTeacher(accessToken, id), "Teacher approved.")
              }
              onReject={(id, reason) =>
                act(id, () => rejectTeacher(accessToken, id, reason), "Application rejected.")
              }
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              ACTIVE TEACHERS ROSTER
          ══════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="mb-3 text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <GraduationCap className="size-4 text-emerald-700" /> Active School Staff
            </h2>
            <TeacherRoster teachers={roster} />
          </section>
        </div>
      )}
    </ConsoleShell>
  );
}

export default function PrincipalPage() {
  return (
    <RoleGate role="principal">
      <PrincipalDashboard />
    </RoleGate>
  );
}
