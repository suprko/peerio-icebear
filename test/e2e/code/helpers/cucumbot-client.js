const cp = require('child_process');
const CucumbotBase = require('./cucumbot-base');

class CucumbotClient extends CucumbotBase {
    finished = false;
    finishedWithError = false;

    hasControl = 0;

    constructor(name, world) {
        super(world);
        this.name = name;
    }

    start() {
        const child = cp.spawn(
            'node',
            [
                '--expose-gc',
                './node_modules/.bin/cucumber-js',
                'test/e2e/spec',
                '-r', 'test/e2e/code',
                '--require-module', 'babel-register',
                '--format', 'node_modules/cucumber-pretty',
                '--format', `json:./test-results/e2e/${this.name}_result.json`,
                '--tags', `@${this.name}`,
                '--exit'
            ],
            {
                stdio: [null, 'pipe', 'pipe', 'ipc'], // stdin, stdout, stderr, + open ipc channel
                env: Object.assign({ CUCUMBOT: 1 }, process.env)
            }
        );

        // incoming messages from Cucumbot
        child.on('message', this.processMessage);

        child.on('close', (code) => {
            this.finished = true;
            this.finishedWithError = code > 0;
            this.emit('finished');
        });

        child.stdout.on('data', data => {
            const msg = data.toString().split('\n');
            msg.forEach(m => console._log('CUCUMBOT:', m));
        });

        this.botProcess = child;

        return new Promise(resolve => {
            this.once('ready', resolve);
        });
    }
}


module.exports = CucumbotClient;