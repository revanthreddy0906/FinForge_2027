import { teamCodesCsv } from "@/lib/admin/selection";
import { selectionCsvResponse } from "@/lib/server/selection-csv-response";

/** Team codes for printing check-in slips. Organizers only. */
export async function GET() {
  return selectionCsvResponse("/admin/statements/codes", "team-codes", teamCodesCsv);
}
