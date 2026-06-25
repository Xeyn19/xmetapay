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
