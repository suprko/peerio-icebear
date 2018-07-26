const cp = require('child_process');
const CucumbotBase = require('./cucumbot-base');
const testConfig = require('../test-config');

class CucumbotClient extends CucumbotBase {
    finished = false;
    finishedWithError = false;

    hasControl = 0;

    constructor(name, world) {
        super(world);
        this.name = name;
    }

    start(noAccount) {
        let env = Object.assign({ CUCUMBOT: 1 }, process.env);
        if (noAccount) {
            env = Object.assign({ CUCUMBOT_DONT_CREATE_ACCOUNT: 1 }, env);
        }
        const child = cp.spawn(
            'node',
            [
                '--expose-gc',
                './node_modules/.bin/cucumber-js',
                'test/e2e/spec',
                '-r',
                'test/e2e/code',
                '--require-module',
                '"@babel/register"',
                '--format',
                'node_modules/cucumber-pretty',
                '--format',
                `json:./test-results/e2e/${this.name}_result.json`,
                '--tags',
                `@${this.name}`,
                '--exit'
            ],
            {
                stdio: [null, 'pipe', 'pipe', 'ipc'], // stdin, stdout, stderr, + open ipc channel
                env
            }
        );

        // incoming messages from Cucumbot
        child.on('message', this.processMessage);

        child.on('close', code => {
            this.finished = true;
            this.finishedWithError = code > 0;
            this.emit('finished');
        });

        if (!testConfig.muteCucumbot) {
            child.stdout.on('data', data => {
                const msg = data.toString().split('\n');
                msg.forEach(m => m && console._logBot('[[CUCUMBOT]]:', m));
            });
        }

        this.botProcess = child;

        return new Promise(resolve => {
            this.once('ready', resolve);
        });
    }
}

module.exports = CucumbotClient;
