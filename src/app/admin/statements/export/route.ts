import { statementTitle } from "@/config/problem-statements";
import { selectionCsv } from "@/lib/admin/selection";
import { selectionCsvResponse } from "@/lib/server/selection-csv-response";

/** Every paid team's choices and assigned statement. Organizers only. */
export async function GET() {
  return selectionCsvResponse("/admin/statements/export", "statement-choices", (teams) =>
    selectionCsv(teams, statementTitle),
  );
}
