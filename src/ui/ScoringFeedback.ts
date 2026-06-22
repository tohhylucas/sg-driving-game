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

  /** Renders current pass and violation counts. */
  update(summary: ScoredEventSummary): void {
    const latestEvent = summary.events.at(-1);

    this.root.dataset.passCount = String(summary.passCount);
    this.root.dataset.violationCount = String(summary.violationCount);
    this.root.dataset.latestOutcome = latestEvent?.outcome ?? '';
    this.root.replaceChildren(
      createMetric('Passes', summary.passCount),
      createMetric('Violations', summary.violationCount)
    );

    if (latestEvent) {
      const latest = document.createElement('div');
      latest.className = 'cockpit__scoring-latest';
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
