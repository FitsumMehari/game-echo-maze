/** Shared DOM helpers for reusable UI pieces. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | boolean | undefined> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (k === "className") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function qs<T extends Element>(root: ParentNode, sel: string): T {
  const found = root.querySelector<T>(sel);
  if (!found) throw new Error(`Missing ${sel}`);
  return found;
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
}
