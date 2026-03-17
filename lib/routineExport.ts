import { saveAs } from "file-saver"
import { Routine } from "@/types/routine"

export function exportRoutine(routine: Partial<Routine>) {
  const blob = new Blob(
    [JSON.stringify(routine, null, 2)],
    { type: "application/json" }
  )

  saveAs(blob, `${routine.name || "routine"}.json`)
}