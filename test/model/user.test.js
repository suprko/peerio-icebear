//
// User module tests
//

const User = require('../../src/models/user');
const helpers = require('../helpers');
const socket = require('../../src/network/socket');
// this is a sequenced test suite
describe('User model', () => {
    const user = new User();
    const userLogin = new User();

    before((done) => {
        user.username = userLogin.username = helpers.getRandomUsername();
        user.passphrase = userLogin.passphrase = 'such a secret passphrase';
        socket.onceConnected(done);
    });

    it('#01 should server-validate username',
        () => User.validateUsername(user.username).then(available => available.should.be.true));

    it('#02 should register new user', () => user.createAccount());

    it('#03 should login', () => userLogin.login());
});
