const { retryUntilSuccess } = require('~/helpers/retry');
const tracker = require('~/models/update-tracker');
const { performance } = require('perf_hooks');

describe('Retry helper should', function() {
    this.timeout(50000);

    before(() => {
        tracker.updated = true;
    });

    it('resolve immediately', async () => {
        const task = () => new Promise((resolve) => {
            resolve();
        });

        await retryUntilSuccess(task).should.eventually.be.fulfilled;
    });

    it('reject 3 times and then resolve', async () => {
        let attemptNumber = 0;
        const task = () => new Promise((resolve, reject) => {
            attemptNumber++;

            if (attemptNumber < 3) {
                reject();
            } else {
                resolve();
            }
        });

        await retryUntilSuccess(task).should.be.fulfilled;
        attemptNumber.should.equal(3);
    });

    it('fail to resolve after 3 tries', async () => {
        let attemptNumber = 0;
        const task = () => new Promise((resolve, reject) => {
            attemptNumber++;
            console.log('attemptNumber', attemptNumber);
            reject();
        });

        await retryUntilSuccess(task, 'task 1', 3).should.be.rejected;
        attemptNumber.should.equal(4); // 4 because it's attempt number, first one doesn't count as retry
    });

    it('should add ~250ms for every failed try', async () => {
        let attemptNumber = 0;
        let started;
        let ended;
        const task = () => new Promise((resolve, reject) => {
            ended = performance.now();
            attemptNumber++;

            if (attemptNumber < 2) {
                reject();
                started = performance.now();
            } else {
                resolve();
            }
        });

        await retryUntilSuccess(task).should.be.fulfilled;
        const timeout = ended - started;
        timeout.should.be.above(1200).and.below(1300);
    });
});

