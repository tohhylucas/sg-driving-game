import type { SessionRuleDiagnostics } from '../rules/DrivingSession';
import type { KeepLeftRuleDiagnostics } from '../rules/KeepLeftRule';
import type { ScoredEventSummary } from '../rules/scoring';

export class ScoringFeedback {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cockpit__scoring-feedback';
    this.root.dataset.instrument = 'scoring-feedback';
    parent.append(this.root);
    this.update({ events: [], passCount: 0, violationCount: 0 });
  }

  /** Renders current pass, violation, and rule diagnostic values. */
  update(
    summary: ScoredEventSummary,
    ruleDiagnostics: readonly SessionRuleDiagnostics[] = [],
    sessionActive = true
  ): void {
    const latestEvent = summary.events.at(-1);
    const keepLeftDiagnostics = ruleDiagnostics.find(isKeepLeftDiagnostics);

    this.root.dataset.passCount = String(summary.passCount);
    this.root.dataset.sessionActive = String(sessionActive);
    this.root.dataset.violationCount = String(summary.violationCount);
    this.root.dataset.latestOutcome = latestEvent?.outcome ?? '';
    syncKeepLeftDataset(this.root, keepLeftDiagnostics, sessionActive);
    this.root.replaceChildren(
      createMetric('Passes', summary.passCount),
      createMetric('Violations', summary.violationCount)
    );

    if (keepLeftDiagnostics) {
      this.root.append(createKeepLeftDebug(keepLeftDiagnostics, sessionActive));
    }

    if (latestEvent) {
      const latest = document.createElement('div');
      latest.className = `cockpit__scoring-latest${
        isImmediateFailureEvent(latestEvent)
          ? ' cockpit__scoring-latest--failure'
          : ''
      }`;
      latest.textContent = latestEvent.message;
      this.root.append(latest);
    }
  }
}

function createMetric(label: string, value: number): HTMLElement {
  const metric = document.createElement('div');
  metric.className = 'cockpit__scoring-metric';

  const valueElement = document.createElement('span');
  valueElement.className = 'cockpit__scoring-value';
  valueElement.textContent = String(value);

  const labelElement = document.createElement('span');
  labelElement.className = 'cockpit__scoring-label';
  labelElement.textContent = label;

  metric.append(valueElement, labelElement);
  return metric;
}

function createKeepLeftDebug(
  diagnostics: KeepLeftRuleDiagnostics,
  sessionActive: boolean
): HTMLElement {
  const debug = document.createElement('div');
  debug.className = 'cockpit__rule-debug';
  debug.dataset.ruleDebug = diagnostics.ruleId;
  debug.dataset.gracePeriodSec = String(diagnostics.gracePeriodSec);
  debug.dataset.laneSide = diagnostics.laneSide;
  debug.dataset.segmentId = diagnostics.segmentId;
  debug.dataset.outsideLaneSec = String(diagnostics.outsideLaneSec);
  debug.dataset.sessionActive = String(sessionActive);
  debug.dataset.withinDefaultLane = String(diagnostics.withinDefaultLane);
  debug.textContent = formatKeepLeftDebugText(diagnostics, sessionActive);
  return debug;
}

function syncKeepLeftDataset(
  root: HTMLElement,
  diagnostics: KeepLeftRuleDiagnostics | undefined,
  sessionActive: boolean
): void {
  if (!diagnostics) {
    delete root.dataset.keepLeftGracePeriodSec;
    delete root.dataset.keepLeftLaneSide;
    delete root.dataset.keepLeftSegmentId;
    delete root.dataset.keepLeftOutsideLaneSec;
    delete root.dataset.keepLeftSessionActive;
    delete root.dataset.keepLeftWithinDefaultLane;
    return;
  }

  root.dataset.keepLeftGracePeriodSec = String(diagnostics.gracePeriodSec);
  root.dataset.keepLeftLaneSide = diagnostics.laneSide;
  root.dataset.keepLeftSegmentId = diagnostics.segmentId;
  root.dataset.keepLeftOutsideLaneSec = String(diagnostics.outsideLaneSec);
  root.dataset.keepLeftSessionActive = String(sessionActive);
  root.dataset.keepLeftWithinDefaultLane = String(
    diagnostics.withinDefaultLane
  );
}

export function formatKeepLeftDebugText(
  diagnostics: KeepLeftRuleDiagnostics,
  sessionActive: boolean
): string {
  const outsideText = sessionActive
    ? `Outside ${diagnostics.outsideLaneSec.toFixed(2)}s`
    : 'Outside paused';

  return [
    `Grace ${diagnostics.gracePeriodSec}s`,
    `Session ${sessionActive ? 'active' : 'finished'}`,
    `Side ${diagnostics.laneSide}`,
    `Correct ${diagnostics.withinDefaultLane ? 'yes' : 'no'}`,
    outsideText
  ].join(' | ');
}

function isKeepLeftDiagnostics(
  diagnostics: SessionRuleDiagnostics
): diagnostics is KeepLeftRuleDiagnostics {
  return diagnostics.ruleId === 'keep-left';
}

function isImmediateFailureEvent(
  event: ScoredEventSummary['events'][number]
): boolean {
  return (
    event.outcome === 'violation' &&
    event.message.startsWith('IMMEDIATE FAILURE')
  );
}
