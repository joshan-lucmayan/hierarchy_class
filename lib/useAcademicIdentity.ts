"use client";

import { useMemo } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

export interface AcademicIdentity {
  programNames: string[];
  sectionNames: string[];
  courseNames: string[];
}

/**
 * Derives a student's academic identity from the real relational data:
 * enrollments -> courses -> sections -> programs. Used to show
 * Program / Grade-Level / Section consistently across profiles, rosters,
 * and leaderboard rows.
 */
export function useAcademicIdentity(profileId: string | undefined): AcademicIdentity {
  const { programs, sections, courses, students: enrollments } = useClassroomHierarchy();

  return useMemo(() => {
    if (!profileId) return { programNames: [], sectionNames: [], courseNames: [] };

    const courseIds = enrollments.filter((e) => e.profileId === profileId).map((e) => e.courseId);
    const myCourses = courses.filter((c) => courseIds.includes(c.id));
    const secIds = Array.from(new Set(myCourses.map((c) => c.sectionId)));
    const mySections = sections.filter((s) => secIds.includes(s.id));
    const progIds = Array.from(new Set(mySections.map((s) => s.programId)));
    const myPrograms = programs.filter((p) => progIds.includes(p.id));

    return {
      programNames: myPrograms.map((p) => p.name),
      sectionNames: mySections.map((s) => s.name),
      courseNames: myCourses.map((c) => c.name),
    };
  }, [profileId, enrollments, courses, sections, programs]);
}

/**
 * One program name per student id (the first program their enrolled courses
 * sit under), for list views like search results and the leaderboard.
 */
export function useProgramByStudent(): Record<string, string> {
  const { programs, sections, courses, students: enrollments } = useClassroomHierarchy();

  return useMemo(() => {
    const map: Record<string, string> = {};
    enrollments.forEach((e) => {
      if (!e.profileId || map[e.profileId]) return;
      const course = courses.find((c) => c.id === e.courseId);
      const section = course ? sections.find((s) => s.id === course.sectionId) : undefined;
      const program = section ? programs.find((p) => p.id === section.programId) : undefined;
      if (program) map[e.profileId] = program.name;
    });
    return map;
  }, [enrollments, courses, sections, programs]);
}
