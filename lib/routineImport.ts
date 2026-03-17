import { Routine } from "@/types/routine"

export async function importRoutine(file: File): Promise<Partial<Routine>> {
  const text = await file.text()
  return JSON.parse(text) as Partial<Routine>
}