"use client";

import { useEffect } from "react";
import { startLesson } from "@/app/actions/learning";

/** Records a first lesson visit without blocking or changing the lesson render. */
export function LessonStart({ cohortId, lessonId }: { cohortId: number; lessonId: number }) {
  useEffect(() => { void startLesson(cohortId, lessonId); }, [cohortId, lessonId]);
  return null;
}
