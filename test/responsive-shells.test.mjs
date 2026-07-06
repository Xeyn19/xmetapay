import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminShell = readFileSync("app/admin/_components/admin-shell.tsx", "utf8");
const parentShell = readFileSync("app/parent/_components/parent-shell.tsx", "utf8");

test("admin and parent shells expose accessible mobile drawer controls", () => {
  [
    { name: "admin", source: adminShell, drawerId: "admin-sidebar" },
    { name: "parent", source: parentShell, drawerId: "parent-sidebar" },
  ].forEach(({ name, source, drawerId }) => {
    assert.match(source, new RegExp(`aria-controls="${drawerId}"`), `${name} menu button should target the drawer`);
    assert.match(source, new RegExp(`id="${drawerId}"`), `${name} drawer should have a stable id`);
    assert.match(source, /aria-modal="true"/, `${name} drawer should be announced as a modal on mobile`);
    assert.match(source, /role="dialog"/, `${name} drawer should expose dialog semantics`);
    assert.doesNotMatch(source, /aria-hidden=\{!(sidebarOpen|open)\}/, `${name} desktop sidebar controls should stay accessible`);
  });
});

test("admin and parent shells guard mobile pages from horizontal overflow", () => {
  [
    { name: "admin", source: adminShell },
    { name: "parent", source: parentShell },
  ].forEach(({ name, source }) => {
    assert.match(source, /overflow-x-hidden/, `${name} root should hide accidental horizontal overflow`);
    assert.match(source, /max-w-full/, `${name} content column should not exceed viewport width`);
    assert.match(source, /min-w-0/, `${name} shell should allow nested content to shrink`);
  });
});

test("admin and parent shells avoid nested nav scrolling", () => {
  [
    { name: "admin", source: adminShell },
    { name: "parent", source: parentShell },
  ].forEach(({ name, source }) => {
    assert.doesNotMatch(
      source,
      /<nav className="[^"]*overflow-y-auto/,
      `${name} nav should not create a second sidebar scrollbar`
    );
    assert.match(
      source,
      /<aside[\s\S]*overflow-y-auto overscroll-contain/,
      `${name} sidebar should own the short-screen overflow fallback`
    );
    assert.match(source, /mt-auto grid shrink-0 gap-2 border-t/, `${name} footer should stay aligned at the bottom`);
  });
});

test("admin and parent shells keep stable sidebar text layout", () => {
  assert.match(adminShell, /w-60 max-w-\[calc\(100vw-24px\)\]/, "admin sidebar should use the shared sidebar width");
  assert.match(adminShell, /lg:pl-60/, "admin content offset should match the shared sidebar width");
  assert.match(parentShell, /w-60 max-w-\[calc\(100vw-24px\)\]/, "parent sidebar should use the shared sidebar width");
  assert.match(parentShell, /lg:pl-60/, "parent content offset should match the shared sidebar width");

  [adminShell, parentShell].forEach((source) => {
    assert.match(source, /<span className="min-w-0 flex-1 truncate">\{item\.label\}<\/span>/);
    assert.match(source, /shrink-0 rounded-full bg-\[#c62828\]/);
    assert.match(source, /<span className="truncate">Log out<\/span>/);
  });
});
