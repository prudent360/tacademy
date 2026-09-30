import { saveAttendance } from "@/app/actions/teach";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/db/schema";

const LABELS = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" } as const;

/** Marks attendance for one live class. Until it's been taken, everyone starts as present, so the teacher only changes the exceptions. */
export function AttendanceForm({ sessionId, students, marks }: { sessionId: number; students: { id: number; name: string }[]; marks: { userId: number; status: AttendanceStatus }[] }) {
  const taken = marks.length > 0;
  return (
    <ActionForm action={saveAttendance.bind(null, sessionId)}>
      {!taken && <p className="text-sm text-muted">Everyone starts as present. Change anyone who was late or missed the class, then save.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {students.map((s) => {
          const current = marks.find((m) => m.userId === s.id)?.status ?? (taken ? "" : "present");
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="font-semibold text-ink">{s.name}</span>
              <span role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex flex-wrap gap-1">
                {ATTENDANCE_STATUSES.map((status) => (
                  <label key={status} className="cursor-pointer">
                    <input type="radio" name={`status-${s.id}`} value={status} defaultChecked={current === status} className="peer sr-only" />
                    <span className="flex h-8 items-center rounded-md border border-edge-strong px-2.5 text-xs font-semibold text-body peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent">{LABELS[status]}</span>
                  </label>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <div><SubmitButton>{taken ? "Update attendance" : "Save attendance"}</SubmitButton></div>
    </ActionForm>
  );
}
