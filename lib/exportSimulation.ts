import { Platform } from "react-native";
import * as XLSX from "xlsx";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

import type { FormattedSimulation } from "@/lib/simulations";

// Matches app/simulations/results.tsx's formatCurrency exactly, so the
// export never disagrees with the numbers already shown on screen.
const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;

function capitalizeWords(value: string) {
  return value
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Plain field/value export -- one row per field, no charts or styling.
 * `reductionPercentage` is passed in rather than recomputed here so the
 * exported figure always matches what the results screen displays (it
 * already falls back to a derived value there when the stored figure is
 * missing/zero).
 */
export async function exportSimulationToExcel(
  simulation: FormattedSimulation,
  reductionPercentage: number
) {
  const { results, buildingName, interventionType, createdAt, id } = simulation;
  const { projected, financial } = results;

  const rows: [string, string][] = [
    ["Field", "Value"],
    ["Building", buildingName],
    ["Scenario", `${capitalizeWords(interventionType)} Strategy`],
    ["Date Run", new Date(createdAt).toLocaleDateString()],
    [
      "CO2 Reduction",
      `${reductionPercentage.toFixed(1)}% (${projected.annualReduction.toFixed(1)} tons CO2/year)`
    ],
    ["Annual Savings", formatCurrency(financial.annualSavings)],
    ["Investment", formatCurrency(financial.implementationCost)],
    ["Payback Period", `${financial.paybackPeriod.toFixed(1)} yrs`]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");

  const safeName = buildingName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const filename = `simulation-${safeName || "results"}-${id}.xlsx`;

  if (Platform.OS === "web") {
    XLSX.writeFile(workbook, filename);
    return;
  }

  // Native has no direct "download" concept -- write the file to the cache
  // dir, then hand it to the OS share sheet so the user can save/send it.
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(new Uint8Array(bytes));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export Simulation Results"
    });
  }
}
