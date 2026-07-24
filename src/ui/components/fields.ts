import { html } from "./dom";

/** Reusable labeled control rows for settings panels. */
export function selectField(id: string, label: string, optionsHtml: string): string {
  return html`<label class="field"
    >${label}<select id="${id}">
      ${optionsHtml}
    </select></label
  >`;
}

export function rangeField(id: string, label: string, min: number, max: number, step: number): string {
  return html`<label class="field"
    >${label}<input type="range" id="${id}" min="${min}" max="${max}" step="${step}"
  /></label>`;
}

export function checkField(id: string, label: string): string {
  return html`<label class="field tick"><input type="checkbox" id="${id}" /> ${label}</label>`;
}

export function textField(
  id: string,
  label: string,
  opts: { max?: number; placeholder?: string; type?: string; autocomplete?: string } = {},
): string {
  const type = opts.type ?? "text";
  const max = opts.max != null ? ` maxlength="${opts.max}"` : "";
  const ph = opts.placeholder ? ` placeholder="${opts.placeholder}"` : "";
  const ac = opts.autocomplete ? ` autocomplete="${opts.autocomplete}"` : "";
  return html`<label class="field">${label}<input type="${type}" id="${id}" ${max}${ph}${ac} /></label>`;
}

export function fieldset(legend: string, body: string, className = "settings-field"): string {
  return html`<fieldset class="${className}">
    <legend>${legend}</legend>
    ${body}
  </fieldset>`;
}

export function btnRow(buttons: string, split = false): string {
  return html`<div class="btn-row${split ? " split" : ""}">${buttons}</div>`;
}

export function button(id: string, label: string, variant: "primary" | "ghost" | "text" = "ghost"): string {
  const cls = variant === "primary" ? "btn-primary" : variant === "text" ? "btn-text" : "btn-ghost";
  return html`<button type="button" id="${id}" class="${cls}">${label}</button>`;
}
