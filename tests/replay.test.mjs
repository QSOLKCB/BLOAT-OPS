import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {runReplay} from '../tools/replay.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/mission-replay.json',import.meta.url)));
test('retained complete-mission input replay matches every pinned digest on repeated runs',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(fixture.inputs)).digest('hex'),fixture.inputSHA256);const a=runReplay(fixture),b=runReplay(fixture);assert.deepEqual(a,b);assert.equal(a.status,'victory');assert.equal(a.digest,fixture.finalDigest);assert.deepEqual(a.checkpoints,fixture.checkpoints);assert.deepEqual(a.stats,fixture.finalStats);assert(a.stats.stuns>0);assert.equal(a.stats.kills,27);
});
