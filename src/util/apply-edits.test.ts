import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits } from './apply-edits.js';

test('replaces a unique match', () => {
  assert.equal(applyEdits('<p>one two</p>', [{ old_text: 'two', new_text: 'three' }]), '<p>one three</p>');
});

test('empty new_text deletes the match', () => {
  assert.equal(applyEdits('<tr><td>a</td></tr><tr><td>b</td></tr>', [{ old_text: '<tr><td>a</td></tr>', new_text: '' }]), '<tr><td>b</td></tr>');
});

test('applies edits in order, each against the previous result', () => {
  const out = applyEdits('alpha', [
    { old_text: 'alpha', new_text: 'beta' },
    { old_text: 'beta', new_text: 'gamma' },
  ]);
  assert.equal(out, 'gamma');
});

test('rejects old_text that is not found, naming the edit', () => {
  assert.throws(
    () => applyEdits('abc', [{ old_text: 'a', new_text: 'x' }, { old_text: 'zzz', new_text: 'y' }]),
    /Edit 1: old_text matched 0 times/
  );
});

test('rejects old_text that matches more than once', () => {
  assert.throws(() => applyEdits('<li>x</li><li>x</li>', [{ old_text: '<li>x</li>', new_text: '' }]), /matched 2 times/);
});

test('counts non-overlapping matches', () => {
  // "aa" in "aaa": found at 0, and the scan resumes at 2, so one match.
  assert.equal(applyEdits('aaa', [{ old_text: 'aa', new_text: 'b' }]), 'ba');
});

test('rejects an empty old_text', () => {
  assert.throws(() => applyEdits('abc', [{ old_text: '', new_text: 'x' }]), /old_text is empty/);
});

test('inserts new_text literally, without $-pattern expansion', () => {
  assert.equal(applyEdits('price: X', [{ old_text: 'X', new_text: "$& $1 $$" }]), "price: $& $1 $$");
});
