/**
 * Client-side CAO/ATW compliance engine.
 * Checks shift schedules against Dutch labor law (Arbeidstijdenwet)
 * and CAO VVT rules. Returns violations as warnings — never blocks.
 */

export interface Shift {
  start: Date;
  end: Date;
  practitionerId: string;
}

export interface ContractInfo {
  urenPerWeek: number;
  fte: number;
}

export interface CaoViolation {
  rule: "max-48h-week" | "min-11h-rest" | "max-10h-shift" | "contract-overschrijding";
  message: string;
  severity: "warning" | "error";
  practitionerId: string;
  details: string;
}

/**
 * Returns the duration of a shift in hours.
 */
export function getShiftHours(shift: Shift): number {
  return (shift.end.getTime() - shift.start.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if a practitioner exceeds 48 hours in the week (ATW art. 5:7).
 * Sums all shift hours for the given practitionerId.
 */
export function checkMaxWeekHours(shifts: Shift[], practitionerId: string): CaoViolation | null {
  const pracShifts = shifts.filter((s) => s.practitionerId === practitionerId);
  const totalHours = pracShifts.reduce((sum, s) => sum + getShiftHours(s), 0);

  if (totalHours > 48) {
    const rounded = Math.round(totalHours);
    return {
      rule: "max-48h-week",
      message: `Medewerker overschrijdt 48 uur per week (ATW). Gepland: ${rounded}u.`,
      severity: "error",
      practitionerId,
      details: `Totaal gepland: ${totalHours.toFixed(1)}u (max 48u per week)`,
    };
  }

  return null;
}

/**
 * Check if any two consecutive shifts have less than 11 hours of rest between them (ATW art. 5:3).
 * Only checks shifts belonging to the given practitionerId.
 */
export function checkMinRest(shifts: Shift[], practitionerId: string): CaoViolation | null {
  const pracShifts = shifts
    .filter((s) => s.practitionerId === practitionerId)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 0; i < pracShifts.length - 1; i++) {
    const current = pracShifts[i]!;
    const next = pracShifts[i + 1]!;
    const restHours = (next.start.getTime() - current.end.getTime()) / (1000 * 60 * 60);

    if (restHours < 11) {
      const fmtDate = (d: Date) =>
        d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "numeric" });
      const endLabel = fmtDate(current.end);
      const startLabel = fmtDate(next.start);

      return {
        rule: "min-11h-rest",
        message: `Minder dan 11 uur rust tussen diensten op ${endLabel} en ${startLabel}.`,
        severity: "error",
        practitionerId,
        details: `Rusttijd: ${restHours.toFixed(1)}u (min 11u vereist)`,
      };
    }
  }

  return null;
}

/**
 * Check if a single shift exceeds 10 hours (CAO VVT art. 5.2).
 */
export function checkMaxShiftLength(shift: Shift): CaoViolation | null {
  const hours = getShiftHours(shift);

  if (hours > 10) {
    const rounded = Math.round(hours);
    return {
      rule: "max-10h-shift",
      message: `Dienst langer dan 10 uur (${rounded}u). Maximaal 10 uur per dienst.`,
      severity: "error",
      practitionerId: shift.practitionerId,
      details: `Dienstduur: ${hours.toFixed(1)}u (max 10u per dienst)`,
    };
  }

  return null;
}

/**
 * Check if planned hours exceed 110% of weekly contract hours.
 */
export function checkContractHours(
  shifts: Shift[],
  practitionerId: string,
  contract: ContractInfo,
): CaoViolation | null {
  const pracShifts = shifts.filter((s) => s.practitionerId === practitionerId);
  const totalHours = pracShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
  const maxAllowed = contract.urenPerWeek * 1.1;

  if (totalHours > maxAllowed) {
    const percentage = Math.round((totalHours / contract.urenPerWeek) * 100);
    return {
      rule: "contract-overschrijding",
      message: `${percentage}% van contracturen gepland (${totalHours.toFixed(1)}/${contract.urenPerWeek}u). Contract: ${contract.urenPerWeek}u/week.`,
      severity: "warning",
      practitionerId,
      details: `Gepland: ${totalHours.toFixed(1)}u, contract: ${contract.urenPerWeek}u (max 110% = ${maxAllowed.toFixed(1)}u)`,
    };
  }

  return null;
}

/**
 * Runs all 4 CAO checks and returns an array of violations.
 * Never blocks — purely informational.
 */
export function validateAllCaoRules(
  shifts: Shift[],
  practitionerId: string,
  contract: ContractInfo,
): CaoViolation[] {
  const violations: CaoViolation[] = [];

  const weekViolation = checkMaxWeekHours(shifts, practitionerId);
  if (weekViolation) violations.push(weekViolation);

  const restViolation = checkMinRest(shifts, practitionerId);
  if (restViolation) violations.push(restViolation);

  // Check each shift for max shift length
  const pracShifts = shifts.filter((s) => s.practitionerId === practitionerId);
  for (const shift of pracShifts) {
    const shiftViolation = checkMaxShiftLength(shift);
    if (shiftViolation) violations.push(shiftViolation);
  }

  const contractViolation = checkContractHours(shifts, practitionerId, contract);
  if (contractViolation) violations.push(contractViolation);

  return violations;
}
