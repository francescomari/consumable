var async = require('async');
var buffer = require('buffer');

var Buffer = buffer.Buffer;

function Consumable(stream) {
    this.buffer = new Buffer(0);

    this.queue = async.queue(executor.bind(this), 0);

    this.error = null;

    this.end = false;

    stream.on('end', onStreamEnd.bind(this));
    stream.on('error', onStreamError.bind(this));
    stream.on('readable', onStreamReadable.bind(this));

    function executor(task, done) {

        // An error occurred. Answer each callback with the same error which occured while reading
        // the buffer.

        if (this.error) {
            process.nextTick(task.callback.bind(null, this.error));
            return done();
        }

        if (task.required > this.buffer.length) {

            // The current task requires more data than the current buffer, but the stream is
            // finished and no more data will be available. Register the error and reschedule the
            // task for execution.

            if (this.end) {
                this.error = new Error('not enough data');
                this.queue.unshift(task);
            }

            // The current task requires more data than the current buffer, but the stream is not
            // finished and there is hope than more data will arrive. Block the queue from executing
            // tasks, and reschedule the current task.

            else {
                this.queue.concurrency = 0;
                this.queue.unshift(task);
            }

            return done();
        }

        // The buffer has enough data to satisfy the current task. Read the data, remove it from
        // the buffer and schedule the task's callback for execution.

        var result = task.read.call(this.buffer, 0);
        this.buffer = this.buffer.slice(task.required);
        process.nextTick(task.callback.bind(null, null, result));
        done();
    }

    // If the stream provides new data, read it. Then, open the queue for processing pending and
    // future tasks.

    function onStreamReadable() {
        var chunk = stream.read();
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.queue.concurrency = 1;
    }

    // If an error occurs while processing the stream, register the error and open the queue for
    // processing pending and future tasks.

    function onStreamError(error) {
        this.error = error;
        this.queue.concurrency = 1;
    }

    // If the stream is ended, register the end of the stream and open the queue for processing
    // pending and future tasks.

    function onStreamEnd() {
        this.end = true;
        this.queue.concurrency = 1;
    }
}

Consumable.prototype.readBytes = function(size, done) {
    this.queue.push({
        required: size,
        callback: done,
        read: function () {
            return this.slice(0, size);
        }
    });
};

// Mimic the Buffer API and make the methods asynchronous

var BUFFER_METHOD_REGEX = /^read(Int|UInt|Float|Double)([0-9]*)(BE|LE)?$/;

Object.keys(Buffer.prototype).forEach(function (method) {
    var match = BUFFER_METHOD_REGEX.exec(method);

    if (match) {
        var size = parseInt(match[2]) / 8;

        if (match[1] === 'Float') {
            size = 4;
        }

        if (match[1] === 'Double') {
            size = 8;
        }

        Consumable.prototype[method] = function (done) {
            this.queue.push({
                required: size, 
                callback: done,
                read: Buffer.prototype[method]
            });
        };
    }
});

module.exports = Consumable;
