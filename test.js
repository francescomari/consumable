var events = require('events');
var buffer = require('buffer');

var Buffer = buffer.Buffer;
var EventEmitter = events.EventEmitter;

var Consumable = require('./consumable');

module.exports = {

    setUp: function (done) {
        this.stream = new EventEmitter();
        this.consumable = new Consumable(this.stream);
        done();
    },

    streamErrorBeforeScheduling: function (test) {
        this.stream.emit('error', new Error('description'));

        this.consumable.readUInt8(function (error, result) {
            test.equal(error.message, 'description');
            test.done();
        });
    },

    schedulingBeforeStreamError: function (test) {
        this.consumable.readUInt8(function (error, result) {
            test.equal(error.message, 'description');
            test.done();
        });

        this.stream.emit('error', new Error('description'));
    },

    streamEndBeforeBigDemand: function (test) {
        this.stream.emit('end');

        this.consumable.readUInt8(function (error, result) {
            test.equal(error.message, 'not enough data');
            test.done();
        });
    },

    bigDemandBeforeStreamEnd: function (test) {
        this.consumable.readUInt8(function (error, result) {
            test.equal(error.message, 'not enough data');
            test.done();
        });

        this.stream.emit('end');
    },

    dataProvidedBeforeDemand: function (test) {
        this.stream.read = function () {
            return new Buffer([0x12]);
        };

        this.stream.emit('readable');

        this.consumable.readUInt8(function (error, result) {
            test.equal(result, 0x12);
            test.done();
        });
    },

    demandBeforeDataProvided: function (test) {
        this.stream.read = function () {
            return new Buffer([0x12]);
        };

        this.consumable.readUInt8(function (error, result) {
            test.equal(result, 0x12);
            test.done();
        });

        this.stream.emit('readable');
    },

    subsequentReads: function (test) {
        this.stream.read = function () {
            return new Buffer([0xde, 0xad]);
        }

        this.stream.emit('readable');

        var consumable = this.consumable;

        consumable.readUInt8(function (error, result) {
            test.equal(result, 0xde);

            consumable.readUInt8(function (error, result) {
                test.equal(result, 0xad);
                test.done();
            });
        });
    },

    readBytes: function (test) {
        this.stream.read = function () {
            return new Buffer([0xde, 0xad]);
        }

        this.stream.emit('readable');

        this.consumable.readBytes(2, function (error, result) {
            test.equal(result.length, 2);
            test.equal(result[0], 0xde);
            test.equal(result[1], 0xad);
            test.done();
        });
    }

};
