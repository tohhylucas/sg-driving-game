import type { SessionRuleDiagnostics } from '../rules/DrivingSession';
import type { KeepLeftRuleDiagnostics } from '../rules/KeepLeftRule';
import type {
  RuleOutcomeSummary,
  ScoredEventSummary,
  SessionOutcomeSummary
} from '../rules/scoring';

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
    sessionActive = true,
    outcomeSummary?: SessionOutcomeSummary
  ): void {
    const latestEvent = summary.events.at(-1);
    const keepLeftDiagnostics = ruleDiagnostics.find(isKeepLeftDiagnostics);
    const shouldShowOutcomeSummary =
      !sessionActive && outcomeSummary !== undefined;

    this.root.dataset.passCount = String(summary.passCount);
    this.root.dataset.sessionActive = String(sessionActive);
    this.root.dataset.sessionOutcomeVisible = String(shouldShowOutcomeSummary);
    this.root.dataset.violationCount = String(summary.violationCount);
    this.root.dataset.latestOutcome = latestEvent?.outcome ?? '';
    this.root.classList.toggle(
      'cockpit__scoring-feedback--summary',
      shouldShowOutcomeSummary
    );

    if (shouldShowOutcomeSummary) {
      syncKeepLeftDataset(this.root, undefined, sessionActive);
      this.root.replaceChildren(createSessionOutcomeSummary(outcomeSummary));
      return;
    }

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

function createSessionOutcomeSummary(
  summary: SessionOutcomeSummary
): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'cockpit__session-summary';
  panel.dataset.instrument = 'session-outcome-summary';

  const title = document.createElement('h2');
  title.className = 'cockpit__session-summary-title';
  title.textContent = 'Session outcome';

  panel.append(
    title,
    createOutcomeGroupSection('Passes', 'passes', summary.passes),
    createOutcomeGroupSection('Violations', 'violations', summary.violations),
    createNotEncounteredSection(summary.notEncountered)
  );

  return panel;
}

function createOutcomeGroupSection(
  title: string,
  key: string,
  groups: readonly RuleOutcomeSummary[]
): HTMLElement {
  const section = createOutcomeSection(title, key);

  if (groups.length === 0) {
    section.append(createEmptyOutcomeText(`No ${key} recorded`));
    return section;
  }

  for (const group of groups) {
    const rule = document.createElement('article');
    rule.className = 'cockpit__session-rule';
    rule.dataset.ruleId = group.ruleId;

    const heading = document.createElement('h4');
    heading.className = 'cockpit__session-rule-title';
    heading.textContent = formatRuleOutcomeLabel(group.ruleId);

    const events = document.createElement('ul');
    events.className = 'cockpit__session-events';

    for (const event of group.events) {
      const item = document.createElement('li');
      item.textContent = event.message;
      events.append(item);
    }

    rule.append(heading, events);
    section.append(rule);
  }

  return section;
}

function createNotEncounteredSection(ruleIds: readonly string[]): HTMLElement {
  const section = createOutcomeSection('Not encountered', 'not-encountered');

  if (ruleIds.length === 0) {
    section.append(createEmptyOutcomeText('Every active rule emitted feedback'));
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'cockpit__session-events';

  for (const ruleId of ruleIds) {
    const item = document.createElement('li');
    item.dataset.ruleId = ruleId;
    item.textContent = formatRuleOutcomeLabel(ruleId);
    list.append(item);
  }

  section.append(list);
  return section;
}

function createOutcomeSection(title: string, key: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'cockpit__session-section';
  section.dataset.outcomeSection = key;

  const heading = document.createElement('h3');
  heading.className = 'cockpit__session-section-title';
  heading.textContent = title;

  section.append(heading);
  return section;
}

function createEmptyOutcomeText(text: string): HTMLElement {
  const empty = document.createElement('p');
  empty.className = 'cockpit__session-empty';
  empty.textContent = text;
  return empty;
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

export function formatRuleOutcomeLabel(ruleId: string): string {
  const words = ruleId.replaceAll('-', ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
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
