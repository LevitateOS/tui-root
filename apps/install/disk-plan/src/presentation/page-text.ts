import { CONFIRM_TOKEN, type ErrorPayload } from "../contract/recpart";

export function confirmStatusLine(token: string): string {
  return token === CONFIRM_TOKEN ? "Status: unlocked" : "Status: locked";
}

/** One apply step; a dry-run step has no status because it has not run. */
export function progressStepLine(phase: string, command: string, status: number | null): string {
  const state = status === null ? "PLANNED" : status === 0 ? "OK" : "FAIL";
  return `[${state}] ${phase} :: ${command}`;
}

export function failureDiagnosticLines(failure: {
  source: string;
  detail: ErrorPayload | null;
  observed: string;
  remediation: string;
}): string[] {
  if (failure.detail) {
    return [
      `Failure Diagnostics (${failure.source})`,
      `Code: ${failure.detail.code}`,
      `Component: ${failure.detail.component}`,
      `Expectation: ${failure.detail.expectation}`,
      `Observed: ${failure.detail.observed}`,
      `Remediation: ${failure.detail.remediation}`,
    ];
  }
  return [
    `Failure Diagnostics (${failure.source})`,
    `Observed: ${failure.observed}`,
    `Remediation: ${failure.remediation}`,
  ];
}
